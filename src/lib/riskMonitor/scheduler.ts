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
import { eq, and, lte, desc, isNull, sql, not, inArray } from "drizzle-orm";
import { rprClient, type RPRPropertyData } from "@/lib/rpr";
import { mmiClient, type MMIPropertyData } from "@/lib/mmi";

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

    return {
      enabled: !record.isPaused,
      checkIntervalDays: record.recheckDays ?? 3,
      windowStartHour: record.scheduleStartHour ?? 21,
      windowEndHour: record.scheduleEndHour ?? 4,
      maxPropertiesPerRun: record.dailyRequestBudget ?? 100,
      rprEnabled: record.rprCredentialsValid ?? true,
      mmiEnabled: record.mmiCredentialsValid ?? true,
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
          sql`(${riskMonitorPolicies.lastCheckedAt} IS NULL OR ${riskMonitorPolicies.lastCheckedAt} < ${cutoffDate})`
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
          status: mmiData?.marketStatus?.currentStatus,
        });
      }

      // Determine new status based on both sources
      result.newStatus = this.determineStatus(rprData, mmiData);

      // Update policy record
      await this.updatePolicyStatus(policy, result.newStatus, rprData, mmiData);

      // Check if status changed and create alert if needed
      if (this.shouldCreateAlert(result.previousStatus, result.newStatus)) {
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
    // Prioritize MMI market status as it's more reliable
    if (mmiData?.marketStatus?.currentStatus) {
      const mmiStatus = mmiData.marketStatus.currentStatus;
      if (mmiStatus !== "unknown") {
        return mmiStatus;
      }
    }

    // Fall back to RPR listing status
    if (rprData?.listing?.active) {
      return "active";
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
    if (mmiData?.marketStatus) {
      if (mmiData.marketStatus.listingDate) {
        updateData.listingDate = new Date(mmiData.marketStatus.listingDate);
      }
      if (mmiData.marketStatus.listingPrice) {
        updateData.listingPrice = mmiData.marketStatus.listingPrice;
      }
      if (mmiData.marketStatus.daysOnMarket) {
        updateData.daysOnMarket = mmiData.marketStatus.daysOnMarket;
      }
      if (mmiData.marketStatus.soldDate) {
        updateData.lastSaleDate = new Date(mmiData.marketStatus.soldDate);
      }
      if (mmiData.marketStatus.soldPrice) {
        updateData.lastSalePrice = mmiData.marketStatus.soldPrice;
      }
    }

    // Extract property details from MMI
    if (mmiData?.valuation) {
      updateData.estimatedValue = mmiData.valuation.estimatedValue;
    }
    if (mmiData?.owner) {
      updateData.ownerName = mmiData.owner.name;
      updateData.ownerOccupied = mmiData.owner.ownerOccupied;
    }

    // Fall back to RPR data
    if (rprData?.listing) {
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

    // Fallback estimated value from RPR
    if (!updateData.estimatedValue && rprData?.estimatedValue) {
      updateData.estimatedValue = rprData.estimatedValue;
    }

    await db
      .update(riskMonitorPolicies)
      .set(updateData)
      .where(eq(riskMonitorPolicies.id, policy.id));
  }

  /**
   * Determine if an alert should be created
   */
  private shouldCreateAlert(previousStatus: string, newStatus: string): boolean {
    // No change
    if (previousStatus === newStatus) return false;

    // Alert on these transitions
    const alertTransitions: Record<string, string[]> = {
      off_market: ["active", "pending", "sold"],
      unknown: ["active", "pending", "sold"],
      active: ["pending", "sold"],
      pending: ["sold"],
    };

    return alertTransitions[previousStatus]?.includes(newStatus) ?? false;
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

    // Create alert
    await db.insert(riskMonitorAlerts).values({
      tenantId: this.tenantId,
      policyId: policy.id,
      alertType: alertType as any,
      priority: priority as any,
      status: "new",
      previousStatus: result.previousStatus as any,
      newStatus: result.newStatus as any,
      title: this.getAlertTitle(alertType, `${policy.addressLine1}, ${policy.city}`),
      description: this.getAlertDescription(alertType, result),
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
   * Get alert description
   */
  private getAlertDescription(alertType: string, result: PropertyCheckResult): string {
    const price =
      result.mmiData?.marketStatus?.listingPrice ||
      result.mmiData?.marketStatus?.soldPrice ||
      result.rprData?.listing?.price;

    const priceStr = price ? `$${price.toLocaleString()}` : "Unknown";

    switch (alertType) {
      case "listing_detected":
        return `Property at ${result.address} has been listed for sale at ${priceStr}. Customer may be planning to move.`;
      case "pending_sale":
        return `Property at ${result.address} is now pending sale. Contact customer urgently about policy changes.`;
      case "sold":
        return `Property at ${result.address} has been sold for ${priceStr}. Policy may need to be cancelled or transferred.`;
      default:
        return `Property status changed from ${result.previousStatus} to ${result.newStatus}.`;
    }
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

    // TODO: Implement email sending via SendGrid or similar
    await this.logEvent("email_sent", policy.id, `Email alert sent for ${alertType}`, {
      recipients: this.settings.alertEmailAddresses,
    });
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
   */
  async run(): Promise<SchedulerRunResult> {
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
        runType: "scheduled",
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

      // Close browser if RPR was used
      if (this.settings?.rprEnabled) {
        await rprClient.close();
      }
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
