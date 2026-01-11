// Risk Monitor Scheduler
// Runs nightly to check properties for listing/sale activity
// Operates within configured time window (default: 9pm - 4am CST)

import { db } from "@/db";
import {
  riskMonitorPolicies,
  riskMonitorAlerts,
  riskMonitorSettings,
  riskMonitorActivityLog,
  riskMonitorActivityEvents,
} from "@/db/schema";
import { eq, and, lte, desc, isNull, sql, not, inArray, or, lt } from "drizzle-orm";
import { rprClient, type RPRPropertyData } from "@/lib/rpr";
import { mmiClient, type MMIPropertyData } from "@/lib/mmi";
import { outlookClient } from "@/lib/outlook";

// =============================================================================
// TYPES
// =============================================================================

interface SchedulerSettings {
  enabled: boolean;
  checkIntervalDays: number;
  windowStartHour: number;
  windowEndHour: number;
  maxPropertiesPerRun: number;
  rprEnabled: boolean;
  mmiEnabled: boolean;
  delayBetweenChecksMs: number;
  emailAlertsEnabled: boolean;
  alertEmailAddresses: string[];
}

interface PropertyCheckResult {
  policyId: string;
  address: string;
  previousStatus: string;
  newStatus: string;
  rprData?: RPRPropertyData | null;
  mmiData?: MMIPropertyData | null;
  alertCreated: boolean;
  error?: string;
}

interface SchedulerRunResult {
  success: boolean;
  runId: string;
  propertiesChecked: number;
  alertsCreated: number;
  errors: string[];
  duration: number;
}

// =============================================================================
// SCHEDULER SERVICE
// =============================================================================

export class RiskMonitorScheduler {
  private tenantId: string;
  private settings: SchedulerSettings | null = null;
  private isRunning: boolean = false;
  private currentRunId: string | null = null;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Get full address string from policy
   */
  private getFullAddress(policy: typeof riskMonitorPolicies.$inferSelect): string {
    const parts = [policy.addressLine1];
    if (policy.addressLine2) parts.push(policy.addressLine2);
    parts.push(`${policy.city}, ${policy.state} ${policy.zipCode}`);
    return parts.join(", ");
  }

  /**
   * Load scheduler settings from database
   */
  async loadSettings(): Promise<SchedulerSettings> {
    const [record] = await db
      .select()
      .from(riskMonitorSettings)
      .where(eq(riskMonitorSettings.tenantId, this.tenantId))
      .limit(1);

    if (!record) {
      // Return defaults
      return {
        enabled: false,
        checkIntervalDays: 3,
        windowStartHour: 21, // 9pm
        windowEndHour: 4, // 4am
        maxPropertiesPerRun: 100,
        rprEnabled: true,
        mmiEnabled: true,
        delayBetweenChecksMs: 5000, // 5 seconds between properties
        emailAlertsEnabled: false,
        alertEmailAddresses: [],
      };
    }

    // Check if token service is configured
    const tokenServiceConfigured = Boolean(process.env.TOKEN_SERVICE_URL);

    return {
      enabled: !record.isPaused,
      checkIntervalDays: record.recheckDays ?? 3,
      windowStartHour: record.scheduleStartHour ?? 21,
      windowEndHour: record.scheduleEndHour ?? 4,
      maxPropertiesPerRun: record.dailyRequestBudget ?? 100,
      // Require both: token service configured AND user has enabled the data source
      rprEnabled: tokenServiceConfigured && (record.rprCredentialsValid ?? true),
      mmiEnabled: tokenServiceConfigured && (record.mmiCredentialsValid ?? true),
      delayBetweenChecksMs: record.delayBetweenCallsMs ?? 5000,
      emailAlertsEnabled: record.emailNotificationsEnabled ?? false,
      alertEmailAddresses: (record.emailRecipients as string[]) ?? [],
    };
  }

  /**
   * Check if current time is within the allowed window
   */
  isWithinWindow(): boolean {
    if (!this.settings) return false;

    // Get current hour in CST
    const now = new Date();
    const cstOffset = -6; // CST is UTC-6
    const utcHour = now.getUTCHours();
    const cstHour = (utcHour + cstOffset + 24) % 24;

    const { windowStartHour, windowEndHour } = this.settings;

    // Handle overnight window (e.g., 21:00 - 04:00)
    if (windowStartHour > windowEndHour) {
      return cstHour >= windowStartHour || cstHour < windowEndHour;
    }

    // Same-day window
    return cstHour >= windowStartHour && cstHour < windowEndHour;
  }

  /**
   * Get properties that need to be checked
   */
  async getPropertiesToCheck(): Promise<typeof riskMonitorPolicies.$inferSelect[]> {
    if (!this.settings) return [];

    const checkIntervalMs = this.settings.checkIntervalDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - checkIntervalMs);

    // Get active policies that haven't been checked recently
    const policies = await db
      .select()
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, this.tenantId),
          eq(riskMonitorPolicies.isActive, true),
          // Either never checked, or last checked before cutoff
          or(
            isNull(riskMonitorPolicies.lastCheckedAt),
            lt(riskMonitorPolicies.lastCheckedAt, cutoffDate)
          )
        )
      )
      .orderBy(riskMonitorPolicies.lastCheckedAt)
      .limit(this.settings.maxPropertiesPerRun);

    return policies;
  }

  /**
   * Check a single property and return results
   */
  async checkProperty(
    policy: typeof riskMonitorPolicies.$inferSelect
  ): Promise<PropertyCheckResult> {
    const fullAddress = this.getFullAddress(policy);
    const result: PropertyCheckResult = {
      policyId: policy.id,
      address: fullAddress,
      previousStatus: policy.currentStatus ?? "unknown",
      newStatus: policy.currentStatus ?? "unknown",
      alertCreated: false,
    };

    try {
      let rprData: RPRPropertyData | null = null;
      let mmiData: MMIPropertyData | null = null;

      // Check RPR
      if (this.settings?.rprEnabled) {
        await this.logEvent("rpr_lookup", policy.id, "Checking RPR...");
        rprData = await rprClient.lookupProperty(fullAddress);
        result.rprData = rprData;
        await this.logEvent("rpr_lookup", policy.id, "RPR check complete", {
          hasListing: !!rprData?.listing,
        });
      }

      // Check MMI
      if (this.settings?.mmiEnabled) {
        await this.logEvent("mmi_lookup", policy.id, "Checking MMI...");
        const mmiResult = await mmiClient.lookupByAddress(fullAddress);
        mmiData = mmiResult.data ?? null;
        result.mmiData = mmiData;
        await this.logEvent("mmi_lookup", policy.id, "MMI check complete", {
          status: mmiData?.currentStatus,
          success: mmiResult.success,
          error: mmiResult.error,
        });
      }

      // IMPORTANT: If we have no real data from either source, skip this property
      // Do NOT create alerts based on no data - that leads to false positives
      if (!rprData && !mmiData) {
        await this.logEvent("no_data", policy.id, "No data from RPR or MMI - skipping to prevent false alerts");
        result.newStatus = policy.currentStatus ?? "unknown";
        return result;
      }

      // Determine new status based on both sources
      result.newStatus = this.determineStatus(rprData, mmiData);

      // Update policy record
      await this.updatePolicyStatus(policy, result.newStatus, rprData, mmiData);

      // Extract sale date for filtering (from MMI or RPR)
      let saleDate: Date | null = null;
      const latestMMIListing = mmiData?.listingHistory?.[0];
      if (latestMMIListing?.SOLD_DATE) {
        saleDate = new Date(latestMMIListing.SOLD_DATE);
      } else if (mmiData?.lastSaleDate) {
        saleDate = new Date(mmiData.lastSaleDate);
      } else if (rprData?.lastSaleDate) {
        saleDate = new Date(rprData.lastSaleDate);
      }

      // Check if status changed and create alert if needed
      if (this.shouldCreateAlert(result.previousStatus, result.newStatus, policy, saleDate)) {
        await this.createAlert(policy, result);
        result.alertCreated = true;
      }
    } catch (error: any) {
      result.error = error.message || "Unknown error";
      await this.logEvent("error", policy.id, `Error: ${result.error}`);
    }

    return result;
  }

  /**
   * Determine property status from RPR and MMI data
   */
  private determineStatus(
    rprData: RPRPropertyData | null | undefined,
    mmiData: MMIPropertyData | null | undefined
  ): string {
    // Check MMI listing history first - most recent listing status is most reliable
    const latestMMIListing = mmiData?.listingHistory?.[0];
    if (latestMMIListing?.STATUS) {
      const mmiListingStatus = latestMMIListing.STATUS.toUpperCase();
      if (mmiListingStatus === "ACTIVE") return "active";
      if (mmiListingStatus === "PENDING" || mmiListingStatus === "UNDER CONTRACT") return "pending";
      if (mmiListingStatus === "SOLD" || mmiListingStatus === "CLOSED") return "sold";
      // WITHDRAWN/EXPIRED/CANCELLED listings should be treated as off_market
      // Don't fall through to RPR mock data which might return incorrect status
      if (mmiListingStatus === "WITHDRAWN" || mmiListingStatus === "EXPIRED" || mmiListingStatus === "CANCELLED") return "off_market";
    }

    // Check RPR listing status
    if (rprData?.listing?.active) {
      return "active";
    }
    if (rprData?.listing?.status) {
      const rprStatus = rprData.listing.status.toLowerCase();
      if (rprStatus === "active") return "active";
      if (rprStatus === "pending" || rprStatus === "under contract") return "pending";
      if (rprStatus === "sold" || rprStatus === "closed") return "sold";
    }

    // Check MMI current status FIRST - real data takes priority over RPR mock data
    if (mmiData?.currentStatus && mmiData.currentStatus !== "unknown") {
      // Map MMI status values to our status values
      const mmiStatus = mmiData.currentStatus.toLowerCase();
      if (mmiStatus === "sold" || mmiStatus === "off_market" || mmiStatus === "off-market") {
        return "off_market"; // Properties marked as sold or off_market in MMI should stay off_market
      }
      return mmiData.currentStatus;
    }

    // Check RPR current status as fallback (may be mock data)
    if (rprData?.currentStatus && rprData.currentStatus !== "unknown") {
      return rprData.currentStatus;
    }

    // Default to off_market
    return "off_market";
  }

  /**
   * Update policy status in database
   */
  private async updatePolicyStatus(
    policy: typeof riskMonitorPolicies.$inferSelect,
    newStatus: string,
    rprData: RPRPropertyData | null | undefined,
    mmiData: MMIPropertyData | null | undefined
  ): Promise<void> {
    const updateData: Partial<typeof riskMonitorPolicies.$inferInsert> = {
      currentStatus: newStatus as any,
      previousStatus: policy.currentStatus,
      lastCheckedAt: new Date(),
      lastStatusChange: newStatus !== policy.currentStatus ? new Date() : policy.lastStatusChange,
      updatedAt: new Date(),
    };

    // Extract listing details from MMI
    if (mmiData) {
      // Get most recent listing from history
      const latestListing = mmiData.listingHistory?.[0];
      if (latestListing) {
        if (latestListing.LISTING_DATE) {
          updateData.listingDate = new Date(latestListing.LISTING_DATE);
        }
        if (latestListing.LIST_PRICE) {
          updateData.listingPrice = latestListing.LIST_PRICE;
        }
        if (latestListing.DAYS_ON_MARKET) {
          updateData.daysOnMarket = latestListing.DAYS_ON_MARKET;
        }
        if (latestListing.CLOSE_PRICE) {
          updateData.lastSalePrice = latestListing.CLOSE_PRICE;
        }
      }

      // Extract last sale from MMI
      if (mmiData.lastSaleDate) {
        updateData.lastSaleDate = new Date(mmiData.lastSaleDate);
      }
      if (mmiData.lastSalePrice) {
        updateData.lastSalePrice = mmiData.lastSalePrice;
      }
    }

    // Fall back to RPR data
    if (rprData) {
      if (rprData.listing) {
        if (!updateData.listingPrice && rprData.listing.price) {
          updateData.listingPrice = rprData.listing.price;
        }
        if (!updateData.listingDate && rprData.listing.daysOnMarket) {
          const listingDate = new Date();
          listingDate.setDate(listingDate.getDate() - rprData.listing.daysOnMarket);
          updateData.listingDate = listingDate;
          updateData.daysOnMarket = rprData.listing.daysOnMarket;
        }
      }
      // Fall back to RPR sale data
      if (!updateData.lastSaleDate && rprData.lastSaleDate) {
        updateData.lastSaleDate = new Date(rprData.lastSaleDate);
      }
      if (!updateData.lastSalePrice && rprData.lastSalePrice) {
        updateData.lastSalePrice = rprData.lastSalePrice;
      }
      // Fallback estimated value from RPR
      if (!updateData.estimatedValue && rprData.estimatedValue) {
        updateData.estimatedValue = rprData.estimatedValue;
      }
    }

    await db
      .update(riskMonitorPolicies)
      .set(updateData)
      .where(eq(riskMonitorPolicies.id, policy.id));
  }

  /**
   * Determine if an alert should be created
   *
   * Alert criteria:
   * - Active/Pending listings: Always alert (customer may be moving)
   * - Sold: Only alert if:
   *   1. Sale occurred within last 12 months
   *   2. Customer has been a client for more than 12 months (established customer)
   */
  private shouldCreateAlert(
    previousStatus: string,
    newStatus: string,
    policy: typeof riskMonitorPolicies.$inferSelect,
    saleDate?: Date | null
  ): boolean {
    // No change
    if (previousStatus === newStatus) return false;

    // Define valid transitions
    const alertTransitions: Record<string, string[]> = {
      off_market: ["active", "pending", "sold"],
      unknown: ["active", "pending", "sold"],
      active: ["pending", "sold"],
      pending: ["sold"],
    };

    // Check if this is a valid transition
    if (!alertTransitions[previousStatus]?.includes(newStatus)) {
      return false;
    }

    // For active/pending listings - always alert
    if (newStatus === "active" || newStatus === "pending") {
      return true;
    }

    // For sold properties - apply additional filtering
    if (newStatus === "sold") {
      const now = new Date();
      const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      // Check 1: Sale must be within last 12 months
      const effectiveSaleDate = saleDate || policy.lastSaleDate;
      if (!effectiveSaleDate || effectiveSaleDate < twelveMonthsAgo) {
        console.log(`[RiskMonitor] Skipping sold alert - sale date (${effectiveSaleDate?.toISOString()}) is older than 12 months`);
        return false;
      }

      // Check 2: Customer must have been a client for more than 12 months
      const customerSince = policy.customerSinceDate;
      if (!customerSince || customerSince > twelveMonthsAgo) {
        console.log(`[RiskMonitor] Skipping sold alert - customer since date (${customerSince?.toISOString()}) is less than 12 months ago`);
        return false;
      }

      // Both criteria met
      return true;
    }

    return false;
  }

  /**
   * Create an alert for status change
   */
  private async createAlert(
    policy: typeof riskMonitorPolicies.$inferSelect,
    result: PropertyCheckResult
  ): Promise<void> {
    // Map status to alert type
    const alertTypeMap: Record<string, string> = {
      active: "listing_detected",
      pending: "pending_sale",
      sold: "sold",
    };

    const alertType = alertTypeMap[result.newStatus] || "status_change";

    // Determine priority based on status
    const priorityMap: Record<string, string> = {
      sold: "1", // Critical
      pending: "2", // High
      active: "3", // Medium
    };

    const priority = priorityMap[result.newStatus] || "4";

    // Extract price information
    const latestListing = result.mmiData?.listingHistory?.[0];
    const listingPrice = latestListing?.LIST_PRICE || result.rprData?.listing?.price;
    const salePrice =
      latestListing?.CLOSE_PRICE ||
      result.mmiData?.lastSalePrice ||
      result.rprData?.lastSalePrice;

    // Create alert with full raw data for verification
    await db.insert(riskMonitorAlerts).values({
      tenantId: this.tenantId,
      policyId: policy.id,
      alertType: alertType as any,
      priority: priority as any,
      status: "new",
      previousStatus: result.previousStatus as any,
      newStatus: result.newStatus as any,
      title: this.getAlertTitle(alertType, `${policy.addressLine1}, ${policy.city}`),
      description: this.getAlertDescription(alertType, result, policy),
      listingPrice: listingPrice || null,
      salePrice: salePrice || null,
      dataSource: result.mmiData ? "mmi" : result.rprData ? "rpr" : null,
      rawData: {
        mmi: result.mmiData || null,
        rpr: result.rprData || null,
        checkedAt: new Date().toISOString(),
        customer: {
          name: policy.contactName,
          email: policy.contactEmail,
          phone: policy.contactPhone,
          azContactId: policy.azContactId,
        },
      },
    });

    await this.logEvent("alert_created", policy.id, `Created ${alertType} alert`, {
      priority,
    });

    // Send email notification if enabled
    if (this.settings?.emailAlertsEnabled && priority <= "2") {
      await this.sendEmailAlert(policy, alertType, result);
    }
  }

  /**
   * Get alert title
   */
  private getAlertTitle(alertType: string, address: string): string {
    const shortAddress = address.split(",")[0];
    switch (alertType) {
      case "listing_detected":
        return `New Listing: ${shortAddress}`;
      case "pending_sale":
        return `Pending Sale: ${shortAddress}`;
      case "sold":
        return `Property Sold: ${shortAddress}`;
      default:
        return `Status Change: ${shortAddress}`;
    }
  }

  /**
   * Get alert description with full details
   */
  private getAlertDescription(
    alertType: string,
    result: PropertyCheckResult,
    policy: typeof riskMonitorPolicies.$inferSelect
  ): string {
    const latestListing = result.mmiData?.listingHistory?.[0];
    const listPrice =
      latestListing?.LIST_PRICE ||
      result.rprData?.listing?.price;
    const salePrice =
      latestListing?.CLOSE_PRICE ||
      result.mmiData?.lastSalePrice ||
      result.rprData?.lastSalePrice;

    const listPriceStr = listPrice ? `$${listPrice.toLocaleString()}` : "N/A";
    const salePriceStr = salePrice ? `$${salePrice.toLocaleString()}` : "N/A";

    // Extract dates - compute RPR list date from daysOnMarket if available
    let rprListDate: string | null = null;
    if (result.rprData?.listing?.daysOnMarket) {
      const date = new Date();
      date.setDate(date.getDate() - result.rprData.listing.daysOnMarket);
      rprListDate = date.toLocaleDateString();
    }
    const listDate = latestListing?.LISTING_DATE || rprListDate || "N/A";
    const saleDate = latestListing?.SOLD_DATE || result.mmiData?.lastSaleDate || result.rprData?.lastSaleDate || "N/A";
    const dataSource = result.mmiData ? "MMI (MLS)" : result.rprData ? "RPR (Realtor)" : "Unknown";

    // Build detailed description
    const lines: string[] = [];

    // Customer Info
    lines.push(`**Customer:** ${policy.contactName || "Unknown"}`);
    if (policy.contactPhone) lines.push(`**Phone:** ${policy.contactPhone}`);
    if (policy.contactEmail) lines.push(`**Email:** ${policy.contactEmail}`);
    lines.push("");

    // Property Info
    lines.push(`**Address:** ${result.address}`);
    lines.push(`**Policy #:** ${policy.policyNumber || "N/A"}`);
    lines.push(`**Carrier:** ${policy.carrier || "N/A"}`);
    lines.push("");

    // Listing/Sale Details
    switch (alertType) {
      case "listing_detected":
        lines.push(`**Status:** Listed for Sale`);
        lines.push(`**List Price:** ${listPriceStr}`);
        lines.push(`**List Date:** ${listDate}`);
        break;
      case "pending_sale":
        lines.push(`**Status:** Pending Sale`);
        lines.push(`**List Price:** ${listPriceStr}`);
        lines.push(`**List Date:** ${listDate}`);
        break;
      case "sold":
        lines.push(`**Status:** SOLD`);
        lines.push(`**List Price:** ${listPriceStr}`);
        lines.push(`**Sale Price:** ${salePriceStr}`);
        lines.push(`**Sale Date:** ${saleDate}`);
        break;
      default:
        lines.push(`**Status Changed:** ${result.previousStatus} → ${result.newStatus}`);
    }
    lines.push("");

    // Data Source
    lines.push(`**Data Source:** ${dataSource}`);
    lines.push(`**Checked:** ${new Date().toLocaleString()}`);
    lines.push("");

    // Links
    if (policy.azContactId) {
      lines.push(`**AgencyZoom:** https://app.agencyzoom.com/customer/index?id=${policy.azContactId}`);
    }
    lines.push(`**App Profile:** https://tcds-triage.vercel.app/customers/${policy.azContactId || policy.id}`);

    return lines.join("\n");

  }

  /**
   * Send email alert for critical events
   */
  private async sendEmailAlert(
    policy: typeof riskMonitorPolicies.$inferSelect,
    alertType: string,
    result: PropertyCheckResult
  ): Promise<void> {
    if (!this.settings?.alertEmailAddresses?.length) return;

    const latestListing = result.mmiData?.listingHistory?.[0];
    const listPrice = latestListing?.LIST_PRICE || result.rprData?.listing?.price;
    const salePrice = latestListing?.CLOSE_PRICE || result.mmiData?.lastSalePrice || result.rprData?.lastSalePrice;

    // Compute RPR list date from daysOnMarket
    let emailRprListDate: string | null = null;
    if (result.rprData?.listing?.daysOnMarket) {
      const date = new Date();
      date.setDate(date.getDate() - result.rprData.listing.daysOnMarket);
      emailRprListDate = date.toLocaleDateString();
    }
    const listDate = latestListing?.LISTING_DATE || emailRprListDate || "N/A";
    const saleDate = latestListing?.SOLD_DATE || result.mmiData?.lastSaleDate || result.rprData?.lastSaleDate || "N/A";
    const dataSource = result.mmiData ? "MMI (MLS)" : result.rprData ? "RPR (Realtor)" : "Unknown";

    const title = this.getAlertTitle(alertType, `${policy.addressLine1}, ${policy.city}`);
    const statusEmoji = alertType === "sold" ? "🏠" : alertType === "pending_sale" ? "⏳" : "📋";

    const emailBody = `
${statusEmoji} RISK MONITOR ALERT - ${title}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CUSTOMER INFORMATION
• Name: ${policy.contactName || "Unknown"}
• Phone: ${policy.contactPhone || "N/A"}
• Email: ${policy.contactEmail || "N/A"}

PROPERTY DETAILS
• Address: ${result.address}
• Policy #: ${policy.policyNumber || "N/A"}
• Carrier: ${policy.carrier || "N/A"}

LISTING / SALE INFORMATION
• Status: ${alertType === "sold" ? "SOLD" : alertType === "pending_sale" ? "Pending Sale" : "Listed for Sale"}
• List Price: ${listPrice ? "$" + listPrice.toLocaleString() : "N/A"}
${alertType === "sold" ? `• Sale Price: ${salePrice ? "$" + salePrice.toLocaleString() : "N/A"}` : ""}
• List Date: ${listDate}
${alertType === "sold" ? `• Sale Date: ${saleDate}` : ""}
• Data Source: ${dataSource}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK LINKS
• AgencyZoom Profile: ${policy.azContactId ? `https://app.agencyzoom.com/customer/index?id=${policy.azContactId}` : "N/A"}
• TCDS App: https://tcds-triage.vercel.app/customers/${policy.azContactId || policy.id}
• Risk Monitor Dashboard: https://tcds-triage.vercel.app/risk-monitor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated alert from the TCDS Risk Monitor.
Please review and take appropriate action.
    `.trim();

    try {
      const sendResult = await outlookClient.sendEmail({
        to: this.settings.alertEmailAddresses,
        subject: `🚨 ${title}`,
        body: emailBody,
        isHtml: false,
      });

      if (sendResult.success) {
        await this.logEvent("email_sent", policy.id, `Email alert sent for ${alertType}`, {
          recipients: this.settings.alertEmailAddresses,
          messageId: sendResult.messageId,
        });
      } else {
        await this.logEvent("email_failed", policy.id, `Failed to send email: ${sendResult.error}`, {
          recipients: this.settings.alertEmailAddresses,
        });
      }
    } catch (err: any) {
      await this.logEvent("email_failed", policy.id, `Email send error: ${err.message}`, {
        recipients: this.settings.alertEmailAddresses,
      });
    }
  }

  /**
   * Log scheduler event
   */
  private async logEvent(
    eventType: string,
    policyId: string | null,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.currentRunId) return;

    await db.insert(riskMonitorActivityEvents).values({
      tenantId: this.tenantId,
      runId: this.currentRunId,
      policyId,
      eventType,
      description: message,
    });
  }

  /**
   * Run the scheduler
   * @param isManual - Whether this is a manual trigger (vs scheduled)
   */
  async run(isManual: boolean = false): Promise<SchedulerRunResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let propertiesChecked = 0;
    let alertsCreated = 0;

    // Load settings
    this.settings = await this.loadSettings();

    // Check if enabled
    if (!this.settings.enabled) {
      return {
        success: false,
        runId: "",
        propertiesChecked: 0,
        alertsCreated: 0,
        errors: ["Scheduler is disabled"],
        duration: 0,
      };
    }

    // Check time window
    if (!this.isWithinWindow()) {
      return {
        success: false,
        runId: "",
        propertiesChecked: 0,
        alertsCreated: 0,
        errors: ["Outside of scheduled time window"],
        duration: 0,
      };
    }

    // Prevent concurrent runs
    if (this.isRunning) {
      return {
        success: false,
        runId: "",
        propertiesChecked: 0,
        alertsCreated: 0,
        errors: ["Scheduler is already running"],
        duration: 0,
      };
    }

    this.isRunning = true;

    // Generate run ID
    const runId = crypto.randomUUID();

    // Create activity log record
    const [logRecord] = await db
      .insert(riskMonitorActivityLog)
      .values({
        tenantId: this.tenantId,
        runId,
        runType: isManual ? "manual" : "scheduled",
        status: "running",
        startedAt: new Date(),
      })
      .returning({ id: riskMonitorActivityLog.id });

    this.currentRunId = logRecord.id;

    try {
      await this.logEvent("run_started", null, "Scheduler run started");

      // Get properties to check
      const properties = await this.getPropertiesToCheck();
      await this.logEvent("properties_loaded", null, `Found ${properties.length} properties to check`);

      // Check each property
      for (const policy of properties) {
        // Check if still within window
        if (!this.isWithinWindow()) {
          await this.logEvent("window_closed", null, "Time window closed, stopping run");
          break;
        }

        const result = await this.checkProperty(policy);
        propertiesChecked++;

        if (result.alertCreated) {
          alertsCreated++;
        }

        if (result.error) {
          errors.push(`${result.address}: ${result.error}`);
        }

        // Delay between properties
        if (this.settings.delayBetweenChecksMs > 0) {
          await new Promise((r) => setTimeout(r, this.settings!.delayBetweenChecksMs));
        }
      }

      // Update activity log
      await db
        .update(riskMonitorActivityLog)
        .set({
          status: "completed",
          completedAt: new Date(),
          policiesChecked: propertiesChecked,
          alertsCreated,
          errorsEncountered: errors.length,
        })
        .where(eq(riskMonitorActivityLog.id, this.currentRunId));

      await this.logEvent("run_completed", null, "Scheduler run completed", {
        propertiesChecked,
        alertsCreated,
        errors: errors.length,
      });
    } catch (error: any) {
      errors.push(error.message || "Unknown error");

      await db
        .update(riskMonitorActivityLog)
        .set({
          status: "failed",
          completedAt: new Date(),
          policiesChecked: propertiesChecked,
          alertsCreated,
          errorsEncountered: errors.length,
          errorMessage: error.message,
        })
        .where(eq(riskMonitorActivityLog.id, this.currentRunId));

      await this.logEvent("run_failed", null, `Run failed: ${error.message}`);
    } finally {
      this.isRunning = false;
      this.currentRunId = null;
    }

    return {
      success: errors.length === 0,
      runId: logRecord.id,
      propertiesChecked,
      alertsCreated,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check a single property manually (outside of scheduled window)
   */
  async checkPropertyManual(policyId: string): Promise<PropertyCheckResult> {
    this.settings = await this.loadSettings();

    const [policy] = await db
      .select()
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.id, policyId),
          eq(riskMonitorPolicies.tenantId, this.tenantId)
        )
      )
      .limit(1);

    if (!policy) {
      return {
        policyId,
        address: "",
        previousStatus: "unknown",
        newStatus: "unknown",
        alertCreated: false,
        error: "Policy not found",
      };
    }

    return this.checkProperty(policy);
  }
}

// Factory function to create scheduler instance
export function createRiskMonitorScheduler(tenantId: string): RiskMonitorScheduler {
  return new RiskMonitorScheduler(tenantId);
}
