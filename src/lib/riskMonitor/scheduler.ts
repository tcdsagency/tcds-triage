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
  customers,
  users,
} from "@/db/schema";
import { eq, and, lte, desc, isNull, sql, not, inArray, or, lt } from "drizzle-orm";
import { rprClient, type RPRPropertyData } from "@/lib/rpr";
import { mmiClient, type MMIPropertyData } from "@/lib/mmi";
import { outlookClient } from "@/lib/outlook";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { normalizeAddress, type NormalizedAddress } from "./addressUtils";
import { buildZillowUrl, fetchZillowPropertyImage } from "@/lib/utils/zillow";

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

export interface PropertyCheckResult {
  policyId: string;
  address: string;
  previousStatus: string;
  newStatus: string;
  rprData?: RPRPropertyData | null;
  mmiData?: MMIPropertyData | null;
  alertCreated: boolean;
  error?: string;
  confidenceScore?: number;
  confidenceFactors?: ConfidenceFactors;
}

export interface ConfidenceFactors {
  rprScore: number;
  mmiScore: number;
  sourceAgreementBoost: number;
  mlsBoost: number;
  freshnessDecay: number;
  finalScore: number;
}

export interface SchedulerRunResult {
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
   * Get normalized address from policy for consistent comparison
   */
  private getNormalizedAddress(policy: typeof riskMonitorPolicies.$inferSelect): NormalizedAddress {
    return normalizeAddress(
      policy.addressLine1,
      policy.addressLine2,
      policy.city,
      policy.state,
      policy.zipCode
    );
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
    // Use normalized address for consistent API lookups
    const normalizedAddr = this.getNormalizedAddress(policy);
    const fullAddress = normalizedAddr.fullAddress;

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

      // Check RPR using normalized address
      if (this.settings?.rprEnabled) {
        await this.logEvent("rpr_lookup", policy.id, `Checking RPR: ${fullAddress}`);
        rprData = await rprClient.lookupProperty(fullAddress);
        result.rprData = rprData;
        // Log detailed RPR results
        const rprStatus = rprData?.listing?.active ? "active" : rprData?.listing?.status || rprData?.currentStatus || "no_data";
        const rprListing = rprData?.listing;
        const rprAgent = rprListing?.agent ? `agent=${rprListing.agent}` : '';
        await this.logEvent("rpr_result", policy.id,
          `RPR: status=${rprStatus}${rprListing ? `, price=${rprListing.price || 'N/A'}, days=${rprListing.daysOnMarket || 'N/A'}` : ''}${rprAgent ? `, ${rprAgent}` : ''}`
        );
      }

      // Check MMI using normalized address
      if (this.settings?.mmiEnabled) {
        await this.logEvent("mmi_lookup", policy.id, `Checking MMI: ${fullAddress}`);
        const mmiResult = await mmiClient.lookupByAddress(fullAddress);
        mmiData = mmiResult.data ?? null;
        result.mmiData = mmiData;
        // Log detailed MMI results - listing info
        const latestListing = mmiData?.listingHistory?.[0];
        const mmiStatus = latestListing?.STATUS || mmiData?.currentStatus || "no_data";
        const mmiAgent = latestListing?.LISTING_AGENT ? `agent=${latestListing.LISTING_AGENT}` : '';
        const mmiBroker = latestListing?.LISTING_BROKER ? `broker=${latestListing.LISTING_BROKER}` : '';
        await this.logEvent("mmi_result", policy.id,
          `MMI: status=${mmiStatus}${latestListing ? `, price=${latestListing.LIST_PRICE || 'N/A'}, listed=${latestListing.LISTING_DATE || 'N/A'}` : ''}${mmiAgent ? `, ${mmiAgent}` : ''}${mmiBroker ? `, ${mmiBroker}` : ''}`
        );
        // Log deed/lender info if available
        const latestDeed = mmiData?.deedHistory?.[0];
        if (latestDeed) {
          await this.logEvent("mmi_deed", policy.id,
            `MMI Deed: lender=${latestDeed.LENDER || 'N/A'}, loan=$${latestDeed.LOAN_AMOUNT || 'N/A'}, date=${latestDeed.DATE || 'N/A'}${latestDeed.BUYER_NAME ? `, buyer=${latestDeed.BUYER_NAME}` : ''}`
          );
        }
      }

      // If no data from either source, still mark as checked but don't create alerts
      if (!rprData && !mmiData) {
        await this.logEvent("no_data", policy.id, "No data from RPR or MMI - marking checked, no alert");
        result.newStatus = policy.currentStatus ?? "unknown";
        // Still update lastCheckedAt so we don't keep retrying this property
        await db
          .update(riskMonitorPolicies)
          .set({ lastCheckedAt: new Date(), updatedAt: new Date() })
          .where(eq(riskMonitorPolicies.id, policy.id));
        return result;
      }

      // Determine new status based on both sources
      result.newStatus = this.determineStatus(rprData, mmiData);

      // Calculate confidence score
      const confidenceFactors = this.calculateConfidenceScore(rprData, mmiData, result.newStatus);
      result.confidenceScore = confidenceFactors.finalScore;
      result.confidenceFactors = confidenceFactors;

      await this.logEvent("confidence_calculated", policy.id, `Confidence score: ${(confidenceFactors.finalScore * 100).toFixed(0)}%`, {
        factors: confidenceFactors,
      });

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
        const created = await this.createAlert(policy, result);
        result.alertCreated = created;
      }
    } catch (error: any) {
      result.error = error.message || "Unknown error";
      await this.logEvent("error", policy.id, `Error: ${result.error}`);

      // Increment error count for the policy
      await db
        .update(riskMonitorPolicies)
        .set({
          checkErrorCount: sql`COALESCE(${riskMonitorPolicies.checkErrorCount}, 0) + 1`,
          lastCheckError: result.error,
          lastCheckedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(riskMonitorPolicies.id, policy.id));
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
   * Calculate confidence score (0.0-1.0) based on source reliability and agreement
   *
   * Scoring factors:
   * - Base scores: RPR (0.6) and MMI (0.7) - MMI slightly higher due to MLS data
   * - Agreement boost: +0.1 if both sources agree on status/dates within 14 days
   * - MLS boost: +0.15 if MLS data confirms active listing or recent sale
   * - Freshness decay: Reduce score if event date is older than 90 days
   */
  private calculateConfidenceScore(
    rprData: RPRPropertyData | null | undefined,
    mmiData: MMIPropertyData | null | undefined,
    determinedStatus: string
  ): ConfidenceFactors {
    const factors: ConfidenceFactors = {
      rprScore: 0,
      mmiScore: 0,
      sourceAgreementBoost: 0,
      mlsBoost: 0,
      freshnessDecay: 0,
      finalScore: 0,
    };

    // Base scores for available data sources
    if (rprData) {
      // RPR base score 0.6
      factors.rprScore = 0.6;
      // Increase if RPR has listing data
      if (rprData.listing?.active || rprData.listing?.status) {
        factors.rprScore = 0.65;
      }
    }

    if (mmiData) {
      // MMI base score 0.7 (higher because MLS-backed)
      factors.mmiScore = 0.7;
      // Increase if MMI has listing history
      if (mmiData.listingHistory?.length) {
        factors.mmiScore = 0.75;
      }
    }

    // Source agreement boost (+0.1)
    // Check if RPR and MMI agree on status or have events within 14 days
    if (rprData && mmiData) {
      const rprStatus = this.extractStatusFromRPR(rprData);
      const mmiStatus = this.extractStatusFromMMI(mmiData);

      if (rprStatus && mmiStatus) {
        // Status agreement
        if (rprStatus === mmiStatus) {
          factors.sourceAgreementBoost = 0.1;
        } else {
          // Check date proximity - events within 14 days
          const rprDate = this.extractEventDateFromRPR(rprData);
          const mmiDate = this.extractEventDateFromMMI(mmiData);

          if (rprDate && mmiDate) {
            const daysDiff = Math.abs(rprDate.getTime() - mmiDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 14) {
              factors.sourceAgreementBoost = 0.1;
            }
          }
        }
      }
    }

    // MLS boost (+0.15) if MLS data aligns with determined status
    const latestMLSListing = mmiData?.listingHistory?.[0];
    if (latestMLSListing?.STATUS) {
      const mlsStatus = latestMLSListing.STATUS.toUpperCase();

      if (
        (determinedStatus === "active" && mlsStatus === "ACTIVE") ||
        (determinedStatus === "pending" && (mlsStatus === "PENDING" || mlsStatus === "UNDER CONTRACT")) ||
        (determinedStatus === "sold" && (mlsStatus === "SOLD" || mlsStatus === "CLOSED"))
      ) {
        factors.mlsBoost = 0.15;
      }
    }

    // Freshness decay - reduce score if event is older than 90 days
    const eventDate = this.extractEventDateFromMMI(mmiData) || this.extractEventDateFromRPR(rprData);
    if (eventDate) {
      const daysSinceEvent = (Date.now() - eventDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceEvent > 365) {
        // Very old events - significant penalty
        factors.freshnessDecay = -0.3;
      } else if (daysSinceEvent > 180) {
        // 6+ months old - moderate penalty
        factors.freshnessDecay = -0.15;
      } else if (daysSinceEvent > 90) {
        // 3-6 months old - small penalty
        factors.freshnessDecay = -0.05;
      }
      // Events within 90 days get no penalty
    }

    // Calculate final score
    // Use the higher of RPR or MMI as base, then add boosts and apply decay
    const baseScore = Math.max(factors.rprScore, factors.mmiScore);
    factors.finalScore = Math.min(
      1.0,
      Math.max(
        0,
        baseScore + factors.sourceAgreementBoost + factors.mlsBoost + factors.freshnessDecay
      )
    );

    return factors;
  }

  /**
   * Extract status from RPR data
   */
  private extractStatusFromRPR(rprData: RPRPropertyData): string | null {
    if (rprData.listing?.active) return "active";
    if (rprData.listing?.status) {
      const status = rprData.listing.status.toLowerCase();
      if (status === "pending" || status === "under contract") return "pending";
      if (status === "sold" || status === "closed") return "sold";
      if (status === "active") return "active";
    }
    if (rprData.currentStatus && rprData.currentStatus !== "unknown") {
      return rprData.currentStatus;
    }
    return null;
  }

  /**
   * Extract status from MMI data
   */
  private extractStatusFromMMI(mmiData: MMIPropertyData): string | null {
    const latestListing = mmiData.listingHistory?.[0];
    if (latestListing?.STATUS) {
      const status = latestListing.STATUS.toUpperCase();
      if (status === "ACTIVE") return "active";
      if (status === "PENDING" || status === "UNDER CONTRACT") return "pending";
      if (status === "SOLD" || status === "CLOSED") return "sold";
    }
    if (mmiData.currentStatus && mmiData.currentStatus !== "unknown") {
      return mmiData.currentStatus;
    }
    return null;
  }

  /**
   * Extract event date from RPR data (listing date or sale date)
   */
  private extractEventDateFromRPR(rprData: RPRPropertyData | null | undefined): Date | null {
    if (!rprData) return null;

    // Try listing date first (calculated from days on market)
    if (rprData.listing?.daysOnMarket) {
      const listDate = new Date();
      listDate.setDate(listDate.getDate() - rprData.listing.daysOnMarket);
      return listDate;
    }

    // Try last sale date
    if (rprData.lastSaleDate) {
      return new Date(rprData.lastSaleDate);
    }

    return null;
  }

  /**
   * Extract event date from MMI data (listing date or sale date)
   */
  private extractEventDateFromMMI(mmiData: MMIPropertyData | null | undefined): Date | null {
    if (!mmiData) return null;

    const latestListing = mmiData.listingHistory?.[0];

    // Try sold date first (most relevant for sold properties)
    if (latestListing?.SOLD_DATE) {
      return new Date(latestListing.SOLD_DATE);
    }

    // Try listing date
    if (latestListing?.LISTING_DATE) {
      return new Date(latestListing.LISTING_DATE);
    }

    // Fallback to last sale date
    if (mmiData.lastSaleDate) {
      return new Date(mmiData.lastSaleDate);
    }

    return null;
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
      // Reset error tracking on successful check
      checkErrorCount: 0,
      lastCheckError: null,
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

    // Suppress alerts for new home purchases: if the property activity occurred
    // before or within 1 week of the policy effective date, this likely reflects
    // the customer's own purchase rather than a future move.
    if (policy.effectiveDate) {
      const activityDate = saleDate || policy.lastSaleDate || policy.listingDate;
      if (activityDate) {
        const cutoff = new Date(policy.effectiveDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (activityDate <= cutoff) {
          console.log(
            `[RiskMonitor] Suppressing ${newStatus} alert for ${policy.addressLine1} - ` +
            `activity date (${activityDate.toISOString()}) is within 1 week of ` +
            `policy effective date (${policy.effectiveDate.toISOString()})`
          );
          return false;
        }
      }
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
  ): Promise<boolean> {
    // Map status to alert type
    const alertTypeMap: Record<string, string> = {
      active: "listing_detected",
      pending: "pending_sale",
      sold: "sold",
    };

    const alertType = alertTypeMap[result.newStatus] || "status_change";

    // DEDUPLICATION: Check if an active alert already exists for this policy and type
    const [existingAlert] = await db
      .select({ id: riskMonitorAlerts.id })
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, this.tenantId),
          eq(riskMonitorAlerts.policyId, policy.id),
          eq(riskMonitorAlerts.alertType, alertType as any),
          or(
            eq(riskMonitorAlerts.status, "new"),
            eq(riskMonitorAlerts.status, "acknowledged")
          )
        )
      )
      .limit(1);

    if (existingAlert) {
      await this.logEvent("alert_skipped", policy.id, `Skipped duplicate ${alertType} alert - active alert already exists`);
      return false;
    }

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

    // Fetch listing photo: try RPR first, fall back to Zillow OG image
    let listingPhotoUrl: string | null = result.rprData?.listingPhotoUrl || null;
    if (!listingPhotoUrl) {
      try {
        listingPhotoUrl = await fetchZillowPropertyImage({
          street: policy.addressLine1,
          city: policy.city,
          state: policy.state,
          zip: policy.zipCode,
        });
      } catch {
        // Zillow scrape is best-effort
      }
    }

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
        listingPhotoUrl,
        confidence: {
          score: result.confidenceScore ?? 0,
          factors: result.confidenceFactors ?? null,
        },
        customer: {
          name: policy.contactName,
          email: policy.contactEmail,
          phone: policy.contactPhone,
          azContactId: policy.azContactId,
        },
      },
    });

    await this.logEvent("alert_created", policy.id, `Created ${alertType} alert (confidence: ${((result.confidenceScore ?? 0) * 100).toFixed(0)}%)`, {
      priority,
      confidenceScore: result.confidenceScore,
    });

    // Send email notification if enabled (for all alert types: sold, pending, active)
    if (this.settings?.emailAlertsEnabled) {
      try {
        await this.sendEmailAlert(policy, alertType, result, listingPhotoUrl);
      } catch (emailErr: any) {
        console.error(`[RiskMonitor] sendEmailAlert failed for ${policy.addressLine1}: ${emailErr.message}`);
        await this.logEvent("email_failed", policy.id, `Email send error: ${emailErr.message}`);
      }
    }

    // Create AgencyZoom note for the customer
    if (policy.azContactId) {
      try {
        await this.createAgencyZoomNote(policy, alertType, result);
      } catch (noteErr: any) {
        console.error(`[RiskMonitor] createAgencyZoomNote failed for ${policy.addressLine1}: ${noteErr.message}`);
        await this.logEvent("az_note_failed", policy.id, `AZ note error: ${noteErr.message}`);
      }
    }

    return true;
  }

  /**
   * Create a note in AgencyZoom for the customer
   */
  private async createAgencyZoomNote(
    policy: typeof riskMonitorPolicies.$inferSelect,
    alertType: string,
    result: PropertyCheckResult
  ): Promise<void> {
    try {
      const azClient = getAgencyZoomClient();
      const azContactId = parseInt(policy.azContactId!, 10);

      if (isNaN(azContactId)) {
        await this.logEvent("agencyzoom_note_skipped", policy.id, "Invalid azContactId - not a number", {
          azContactId: policy.azContactId,
        });
        return;
      }

      const latestListing = result.mmiData?.listingHistory?.[0];
      const listPrice = latestListing?.LIST_PRICE || result.rprData?.listing?.price;
      const salePrice = latestListing?.CLOSE_PRICE || result.mmiData?.lastSalePrice || result.rprData?.lastSalePrice;

      // Compute list date
      let listDate: string = "N/A";
      if (latestListing?.LISTING_DATE) {
        listDate = latestListing.LISTING_DATE;
      } else if (result.rprData?.listing?.daysOnMarket) {
        const date = new Date();
        date.setDate(date.getDate() - result.rprData.listing.daysOnMarket);
        listDate = date.toLocaleDateString();
      }

      const saleDate = latestListing?.SOLD_DATE || result.mmiData?.lastSaleDate || result.rprData?.lastSaleDate || "N/A";
      const dataSource = result.mmiData ? "MMI (MLS)" : result.rprData ? "RPR" : "Unknown";

      // Build note content
      let statusText = "";
      let detailsText = "";

      switch (alertType) {
        case "listing_detected":
          statusText = "🏠 PROPERTY LISTED FOR SALE";
          detailsText = `List Price: ${listPrice ? "$" + listPrice.toLocaleString() : "N/A"}\nList Date: ${listDate}`;
          break;
        case "pending_sale":
          statusText = "⏳ PROPERTY PENDING SALE";
          detailsText = `List Price: ${listPrice ? "$" + listPrice.toLocaleString() : "N/A"}\nList Date: ${listDate}`;
          break;
        case "sold":
          statusText = "🔴 PROPERTY SOLD";
          detailsText = `List Price: ${listPrice ? "$" + listPrice.toLocaleString() : "N/A"}\nSale Price: ${salePrice ? "$" + salePrice.toLocaleString() : "N/A"}\nSale Date: ${saleDate}`;
          break;
        default:
          statusText = "📋 PROPERTY STATUS CHANGE";
          detailsText = `Previous: ${result.previousStatus}\nCurrent: ${result.newStatus}`;
      }

      const noteContent = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${statusText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Property: ${result.address}
Policy #: ${policy.policyNumber || "N/A"}

${detailsText}

Data Source: ${dataSource}
Detected: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Auto-generated by TCDS Risk Monitor]
      `.trim();

      const noteResult = await azClient.addNote(azContactId, noteContent);

      if (noteResult.success) {
        await this.logEvent("agencyzoom_note_created", policy.id, `Created AgencyZoom note for ${alertType}`, {
          azContactId: policy.azContactId,
          noteId: noteResult.id,
        });
      } else {
        await this.logEvent("agencyzoom_note_failed", policy.id, `Failed to create AgencyZoom note`, {
          azContactId: policy.azContactId,
        });
      }
    } catch (err: any) {
      await this.logEvent("agencyzoom_note_error", policy.id, `Error creating AgencyZoom note: ${err.message}`, {
        azContactId: policy.azContactId,
      });
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
      lines.push(`**App Profile:** https://tcds-triage.vercel.app/customers/${policy.azContactId}?azId=${policy.azContactId}`);
    }

    return lines.join("\n");

  }

  /**
   * Look up CSR and Producer email addresses for a policy via the customers table
   */
  private async getAgentEmailsForPolicy(
    policy: typeof riskMonitorPolicies.$inferSelect
  ): Promise<string[]> {
    if (!policy.azContactId) return [];

    try {
      // Find the customer record by agencyzoom_id
      const [customer] = await db
        .select({
          producerId: customers.producerId,
          csrId: customers.csrId,
        })
        .from(customers)
        .where(eq(customers.agencyzoomId, policy.azContactId))
        .limit(1);

      if (!customer) return [];

      // Collect unique user IDs to look up
      const userIds = new Set<string>();
      if (customer.producerId) userIds.add(customer.producerId);
      if (customer.csrId) userIds.add(customer.csrId);

      if (userIds.size === 0) return [];

      // Query users table for their email addresses
      const agentUsers = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));

      return agentUsers
        .map((u) => u.email)
        .filter((email): email is string => Boolean(email));
    } catch (err: any) {
      console.error(`[RiskMonitor] Error looking up agent emails for policy ${policy.id}: ${err.message}`);
      return [];
    }
  }

  /**
   * Send email alert for critical events
   */
  private async sendEmailAlert(
    policy: typeof riskMonitorPolicies.$inferSelect,
    alertType: string,
    result: PropertyCheckResult,
    listingPhotoUrl?: string | null
  ): Promise<void> {
    // Look up agent emails for this policy (CSR + Producer)
    const agentEmails = await this.getAgentEmailsForPolicy(policy);
    const staticRecipients = this.settings?.alertEmailAddresses ?? [];

    // Merge static recipients + agent emails, dedup
    const allRecipients = Array.from(
      new Set([...staticRecipients, ...agentEmails].map((e) => e.toLowerCase()))
    );

    if (allRecipients.length === 0) {
      console.warn(`[RiskMonitor] No email recipients for ${policy.addressLine1} - staticRecipients: ${JSON.stringify(staticRecipients)}, agentEmails: ${JSON.stringify(agentEmails)}`);
      await this.logEvent("email_skipped", policy.id, "No email recipients configured");
      return;
    }

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
    const zillowUrl = buildZillowUrl({ street: policy.addressLine1, city: policy.city, state: policy.state, zip: policy.zipCode });

    // Fetch the listing photo URL from the just-created alert rawData
    const photoUrl = listingPhotoUrl;

    const statusLabel = alertType === "sold" ? "SOLD" : alertType === "pending_sale" ? "Pending Sale" : "Listed for Sale";
    const statusColor = alertType === "sold" ? "#DC2626" : alertType === "pending_sale" ? "#EA580C" : "#CA8A04";

    const whatThisMeans = alertType === "listing_detected"
      ? "This customer's insured property has been listed for sale. This may indicate they are planning to move and could cancel or need changes to their policy."
      : alertType === "pending_sale"
      ? "This customer's insured property is under contract. A sale is likely imminent. Policy changes or cancellation may be needed soon."
      : "This customer's insured property has sold. They may need to cancel their homeowners policy or transfer coverage to a new address.";

    const suggestedActions = alertType === "listing_detected"
      ? `<ol><li>Reach out to confirm they are selling</li><li>Ask if they have a new home that needs coverage</li><li>Discuss any policy changes needed during the listing period</li><li>Set a follow-up reminder to check back in 30 days</li></ol>`
      : alertType === "pending_sale"
      ? `<ol><li>Contact the customer to confirm the pending sale</li><li>Ask about the closing date and whether they need coverage through closing</li><li>Discuss coverage for their next home</li><li>Prepare for policy cancellation or transfer at closing</li></ol>`
      : `<ol><li>Confirm the sale has closed</li><li>Process policy cancellation or update the insured property address</li><li>Check if they need coverage for a new home</li><li>Review their remaining policies for any cross-sell opportunities</li></ol>`;

    const azProfileUrl = policy.azContactId ? `https://app.agencyzoom.com/customer/index?id=${policy.azContactId}` : null;
    const tcdsAppUrl = policy.azContactId ? `https://tcds-triage.vercel.app/customers/${policy.azContactId}?azId=${policy.azContactId}` : null;

    const emailBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
  <div style="background: ${statusColor}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">${statusEmoji} RISK MONITOR ALERT</h2>
    <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">${title}</p>
  </div>

  <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
    ${photoUrl ? `<div style="margin-bottom: 16px;"><img src="${photoUrl}" alt="Property Photo" style="width: 100%; max-height: 250px; object-fit: cover; border-radius: 6px;" /></div>` : ""}

    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td colspan="2" style="padding: 8px 0 4px; font-weight: 600; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Customer Information</td></tr>
      <tr><td style="padding: 2px 0; color: #6b7280; width: 100px;">Name:</td><td style="padding: 2px 0; font-weight: 500;">${policy.contactName || "Unknown"}</td></tr>
      <tr><td style="padding: 2px 0; color: #6b7280;">Phone:</td><td style="padding: 2px 0;">${policy.contactPhone || "N/A"}</td></tr>
      <tr><td style="padding: 2px 0; color: #6b7280;">Email:</td><td style="padding: 2px 0;">${policy.contactEmail || "N/A"}</td></tr>

      <tr><td colspan="2" style="padding: 12px 0 4px; font-weight: 600; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid #f3f4f6;">Property Details</td></tr>
      <tr><td style="padding: 2px 0; color: #6b7280;">Address:</td><td style="padding: 2px 0;">${result.address}</td></tr>
      ${zillowUrl ? `<tr><td style="padding: 2px 0; color: #6b7280;">Zillow:</td><td style="padding: 2px 0;"><a href="${zillowUrl}" style="color: #2563eb;">${zillowUrl}</a></td></tr>` : ""}
      <tr><td style="padding: 2px 0; color: #6b7280;">Policy #:</td><td style="padding: 2px 0;">${policy.policyNumber || "N/A"}</td></tr>
      <tr><td style="padding: 2px 0; color: #6b7280;">Carrier:</td><td style="padding: 2px 0;">${policy.carrier || "N/A"}</td></tr>

      <tr><td colspan="2" style="padding: 12px 0 4px; font-weight: 600; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-top: 1px solid #f3f4f6;">Listing / Sale Information</td></tr>
      <tr><td style="padding: 2px 0; color: #6b7280;">Status:</td><td style="padding: 2px 0; font-weight: 600; color: ${statusColor};">${statusLabel}</td></tr>
      <tr><td style="padding: 2px 0; color: #6b7280;">List Price:</td><td style="padding: 2px 0;">${listPrice ? "$" + listPrice.toLocaleString() : "N/A"}</td></tr>
      ${alertType === "sold" ? `<tr><td style="padding: 2px 0; color: #6b7280;">Sale Price:</td><td style="padding: 2px 0;">${salePrice ? "$" + salePrice.toLocaleString() : "N/A"}</td></tr>` : ""}
      <tr><td style="padding: 2px 0; color: #6b7280;">List Date:</td><td style="padding: 2px 0;">${listDate}</td></tr>
      ${alertType === "sold" ? `<tr><td style="padding: 2px 0; color: #6b7280;">Sale Date:</td><td style="padding: 2px 0;">${saleDate}</td></tr>` : ""}
      <tr><td style="padding: 2px 0; color: #6b7280;">Data Source:</td><td style="padding: 2px 0;">${dataSource}</td></tr>
    </table>

    <div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 6px;">
      <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">What This Means</p>
      <p style="margin: 0; font-size: 14px; line-height: 1.5;">${whatThisMeans}</p>
    </div>

    <div style="margin-top: 12px; padding: 12px; background: #f9fafb; border-radius: 6px;">
      <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Suggested Actions</p>
      <div style="font-size: 14px; line-height: 1.6;">${suggestedActions}</div>
    </div>

    <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; font-weight: 600; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Quick Links</p>
      <div style="font-size: 14px; line-height: 1.8;">
        ${azProfileUrl ? `<a href="${azProfileUrl}" style="color: #2563eb;">AgencyZoom Profile</a><br/>` : ""}
        ${tcdsAppUrl ? `<a href="${tcdsAppUrl}" style="color: #2563eb;">TCDS App Profile</a><br/>` : ""}
        ${zillowUrl ? `<a href="${zillowUrl}" style="color: #2563eb;">Zillow Property Page</a><br/>` : ""}
        <a href="https://tcds-triage.vercel.app/risk-monitor" style="color: #2563eb;">Risk Monitor Dashboard</a>
      </div>
    </div>
  </div>

  <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">
    This is an automated alert from the TCDS Risk Monitor.<br/>Please review and take appropriate action.
  </p>
</div>
    `.trim();

    try {
      const sendResult = await outlookClient.sendEmail({
        to: allRecipients,
        subject: `🚨 ${title}`,
        body: emailBody,
        isHtml: true,
      });

      if (sendResult.success) {
        // Update alert record with email tracking
        await db
          .update(riskMonitorAlerts)
          .set({
            emailSentAt: new Date(),
            emailRecipients: allRecipients,
          })
          .where(
            and(
              eq(riskMonitorAlerts.tenantId, this.tenantId),
              eq(riskMonitorAlerts.policyId, policy.id),
              eq(riskMonitorAlerts.alertType, alertType as any),
              eq(riskMonitorAlerts.status, "new")
            )
          );

        await this.logEvent("email_sent", policy.id, `Email alert sent for ${alertType} to ${allRecipients.join(", ")}`, {
          recipients: allRecipients,
          agentEmails: agentEmails.length > 0 ? agentEmails : undefined,
          messageId: sendResult.messageId,
        });
      } else {
        console.error(`[RiskMonitor] Outlook sendEmail failed for ${policy.addressLine1}: ${sendResult.error}`);
        await this.logEvent("email_failed", policy.id, `Failed to send email: ${sendResult.error}`, {
          recipients: allRecipients,
        });
      }
    } catch (err: any) {
      await this.logEvent("email_failed", policy.id, `Email send error: ${err.message}`, {
        recipients: allRecipients,
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
   * @param policyId - The policy ID to check
   * @param forceRescan - If true, ignores lastCheckedAt and performs check regardless
   */
  async checkPropertyManual(
    policyId: string,
    forceRescan: boolean = false
  ): Promise<PropertyCheckResult> {
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

    // Check if we should skip based on recent check (unless force_rescan)
    if (!forceRescan && policy.lastCheckedAt) {
      const checkIntervalMs = (this.settings?.checkIntervalDays ?? 3) * 24 * 60 * 60 * 1000;
      const timeSinceLastCheck = Date.now() - policy.lastCheckedAt.getTime();

      if (timeSinceLastCheck < checkIntervalMs) {
        const hoursRemaining = Math.ceil((checkIntervalMs - timeSinceLastCheck) / (1000 * 60 * 60));
        return {
          policyId,
          address: this.getFullAddress(policy),
          previousStatus: policy.currentStatus ?? "unknown",
          newStatus: policy.currentStatus ?? "unknown",
          alertCreated: false,
          error: `Recently checked - next check available in ${hoursRemaining} hours. Use force_rescan to override.`,
        };
      }
    }

    // If policy has too many consecutive errors, require force to retry
    if (!forceRescan && (policy.checkErrorCount ?? 0) >= 3) {
      return {
        policyId,
        address: this.getFullAddress(policy),
        previousStatus: policy.currentStatus ?? "unknown",
        newStatus: policy.currentStatus ?? "unknown",
        alertCreated: false,
        error: `Skipped due to ${policy.checkErrorCount} consecutive errors: ${policy.lastCheckError}. Use force_rescan to retry.`,
      };
    }

    // Create a temporary run ID for logging if we don't have one
    // This ensures events are tracked when called via API endpoint
    const needsRunId = !this.currentRunId;
    if (needsRunId) {
      const runId = crypto.randomUUID();
      const [logRecord] = await db
        .insert(riskMonitorActivityLog)
        .values({
          tenantId: this.tenantId,
          runId,
          runType: "manual",
          status: "running",
          startedAt: new Date(),
        })
        .returning({ id: riskMonitorActivityLog.id });
      this.currentRunId = logRecord.id;
    }

    try {
      const result = await this.checkProperty(policy);

      // Update the activity log if we created one
      if (needsRunId && this.currentRunId) {
        await db
          .update(riskMonitorActivityLog)
          .set({
            status: "completed",
            completedAt: new Date(),
            policiesChecked: 1,
            alertsCreated: result.alertCreated ? 1 : 0,
            rprCallsMade: this.settings?.rprEnabled ? 1 : 0,
            mmiCallsMade: this.settings?.mmiEnabled ? 1 : 0,
          })
          .where(eq(riskMonitorActivityLog.id, this.currentRunId));
      }

      return result;
    } catch (error) {
      // Update the activity log with error if we created one
      if (needsRunId && this.currentRunId) {
        await db
          .update(riskMonitorActivityLog)
          .set({
            status: "failed",
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          })
          .where(eq(riskMonitorActivityLog.id, this.currentRunId));
      }
      throw error;
    } finally {
      // Clean up the run ID if we created it
      if (needsRunId) {
        this.currentRunId = null;
      }
    }
  }

  /**
   * Queue a policy for rescan in the next scheduled run
   * (resets lastCheckedAt to null)
   */
  async queueForRescan(policyId: string): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: "Policy not found" };
    }

    await db
      .update(riskMonitorPolicies)
      .set({
        lastCheckedAt: null,
        checkErrorCount: 0,
        lastCheckError: null,
        updatedAt: new Date(),
      })
      .where(eq(riskMonitorPolicies.id, policyId));

    return { success: true };
  }

  /**
   * Reset error count for a policy (allows it to be checked again)
   */
  async resetErrorCount(policyId: string): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: "Policy not found" };
    }

    await db
      .update(riskMonitorPolicies)
      .set({
        checkErrorCount: 0,
        lastCheckError: null,
        updatedAt: new Date(),
      })
      .where(eq(riskMonitorPolicies.id, policyId));

    return { success: true };
  }

  /**
   * Pause monitoring for a specific policy
   */
  async pausePolicy(policyId: string): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: "Policy not found" };
    }

    await db
      .update(riskMonitorPolicies)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(riskMonitorPolicies.id, policyId));

    return { success: true };
  }

  /**
   * Resume monitoring for a specific policy
   */
  async resumePolicy(policyId: string): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: "Policy not found" };
    }

    await db
      .update(riskMonitorPolicies)
      .set({
        isActive: true,
        checkErrorCount: 0,
        lastCheckError: null,
        updatedAt: new Date(),
      })
      .where(eq(riskMonitorPolicies.id, policyId));

    return { success: true };
  }

  /**
   * Get skip statistics for the tenant
   */
  async getSkipStats(): Promise<{
    totalPolicies: number;
    activePolicies: number;
    pausedPolicies: number;
    erroredPolicies: number;
    recentlyChecked: number;
    pendingCheck: number;
  }> {
    const checkIntervalMs = (this.settings?.checkIntervalDays ?? 3) * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - checkIntervalMs);

    const stats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorPolicies.isActive} = true)`,
        paused: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorPolicies.isActive} = false)`,
        errored: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorPolicies.checkErrorCount} >= 3)`,
        recentlyChecked: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorPolicies.lastCheckedAt} > ${cutoffDate})`,
      })
      .from(riskMonitorPolicies)
      .where(eq(riskMonitorPolicies.tenantId, this.tenantId));

    const result = stats[0];
    return {
      totalPolicies: Number(result?.total ?? 0),
      activePolicies: Number(result?.active ?? 0),
      pausedPolicies: Number(result?.paused ?? 0),
      erroredPolicies: Number(result?.errored ?? 0),
      recentlyChecked: Number(result?.recentlyChecked ?? 0),
      pendingCheck: Number(result?.active ?? 0) - Number(result?.recentlyChecked ?? 0),
    };
  }

  /**
   * Get operational metrics for a time period
   */
  async getOperationalMetrics(days: number = 7): Promise<{
    period: { start: Date; end: Date };
    runs: {
      total: number;
      successful: number;
      failed: number;
      averageDuration: number;
    };
    properties: {
      totalChecked: number;
      averagePerRun: number;
      uniqueProperties: number;
    };
    alerts: {
      created: number;
      byType: Record<string, number>;
      byPriority: Record<string, number>;
    };
    apiCalls: {
      rpr: { total: number; success: number; errorRate: number };
      mmi: { total: number; success: number; errorRate: number };
    };
    errors: {
      total: number;
      byType: Record<string, number>;
    };
  }> {
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get run statistics
    const runStats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        successful: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorActivityLog.status} = 'completed')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorActivityLog.status} = 'failed')`,
        totalDuration: sql<number>`SUM(EXTRACT(EPOCH FROM (${riskMonitorActivityLog.completedAt} - ${riskMonitorActivityLog.startedAt})) * 1000)`,
        totalPoliciesChecked: sql<number>`SUM(${riskMonitorActivityLog.policiesChecked})`,
        totalAlertsCreated: sql<number>`SUM(${riskMonitorActivityLog.alertsCreated})`,
      })
      .from(riskMonitorActivityLog)
      .where(
        and(
          eq(riskMonitorActivityLog.tenantId, this.tenantId),
          sql`${riskMonitorActivityLog.startedAt} >= ${startDate}`,
          sql`${riskMonitorActivityLog.startedAt} <= ${endDate}`
        )
      );

    const runs = runStats[0];
    const totalRuns = Number(runs?.total ?? 0);
    const successfulRuns = Number(runs?.successful ?? 0);
    const totalPoliciesChecked = Number(runs?.totalPoliciesChecked ?? 0);

    // Get alert statistics
    const alertStats = await db
      .select({
        total: sql<number>`COUNT(*)`,
        listingDetected: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorAlerts.alertType} = 'listing_detected')`,
        pendingSale: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorAlerts.alertType} = 'pending_sale')`,
        sold: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorAlerts.alertType} = 'sold')`,
        priority1: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorAlerts.priority} = '1')`,
        priority2: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorAlerts.priority} = '2')`,
        priority3: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorAlerts.priority} = '3')`,
        priority4: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorAlerts.priority} = '4')`,
      })
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, this.tenantId),
          sql`${riskMonitorAlerts.createdAt} >= ${startDate}`,
          sql`${riskMonitorAlerts.createdAt} <= ${endDate}`
        )
      );

    const alerts = alertStats[0];

    // Get API call statistics from activity events
    const eventStats = await db
      .select({
        rprTotal: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorActivityEvents.eventType} = 'rpr_lookup')`,
        rprSuccess: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorActivityEvents.eventType} = 'rpr_lookup' AND ${riskMonitorActivityEvents.description} LIKE '%complete%')`,
        mmiTotal: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorActivityEvents.eventType} = 'mmi_lookup')`,
        mmiSuccess: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorActivityEvents.eventType} = 'mmi_lookup' AND ${riskMonitorActivityEvents.description} LIKE '%complete%')`,
        errorTotal: sql<number>`COUNT(*) FILTER (WHERE ${riskMonitorActivityEvents.eventType} = 'error')`,
      })
      .from(riskMonitorActivityEvents)
      .where(
        and(
          eq(riskMonitorActivityEvents.tenantId, this.tenantId),
          sql`${riskMonitorActivityEvents.createdAt} >= ${startDate}`,
          sql`${riskMonitorActivityEvents.createdAt} <= ${endDate}`
        )
      );

    const events = eventStats[0];
    const rprTotal = Number(events?.rprTotal ?? 0);
    const rprSuccess = Number(events?.rprSuccess ?? 0);
    const mmiTotal = Number(events?.mmiTotal ?? 0);
    const mmiSuccess = Number(events?.mmiSuccess ?? 0);

    // Get unique properties checked
    const uniqueProps = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${riskMonitorPolicies.id})`,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, this.tenantId),
          sql`${riskMonitorPolicies.lastCheckedAt} >= ${startDate}`,
          sql`${riskMonitorPolicies.lastCheckedAt} <= ${endDate}`
        )
      );

    return {
      period: { start: startDate, end: endDate },
      runs: {
        total: totalRuns,
        successful: successfulRuns,
        failed: Number(runs?.failed ?? 0),
        averageDuration: totalRuns > 0
          ? Math.round(Number(runs?.totalDuration ?? 0) / totalRuns)
          : 0,
      },
      properties: {
        totalChecked: totalPoliciesChecked,
        averagePerRun: totalRuns > 0
          ? Math.round(totalPoliciesChecked / totalRuns)
          : 0,
        uniqueProperties: Number(uniqueProps[0]?.count ?? 0),
      },
      alerts: {
        created: Number(alerts?.total ?? 0),
        byType: {
          listing_detected: Number(alerts?.listingDetected ?? 0),
          pending_sale: Number(alerts?.pendingSale ?? 0),
          sold: Number(alerts?.sold ?? 0),
        },
        byPriority: {
          critical: Number(alerts?.priority1 ?? 0),
          high: Number(alerts?.priority2 ?? 0),
          medium: Number(alerts?.priority3 ?? 0),
          low: Number(alerts?.priority4 ?? 0),
        },
      },
      apiCalls: {
        rpr: {
          total: rprTotal,
          success: rprSuccess,
          errorRate: rprTotal > 0
            ? Math.round(((rprTotal - rprSuccess) / rprTotal) * 100)
            : 0,
        },
        mmi: {
          total: mmiTotal,
          success: mmiSuccess,
          errorRate: mmiTotal > 0
            ? Math.round(((mmiTotal - mmiSuccess) / mmiTotal) * 100)
            : 0,
        },
      },
      errors: {
        total: Number(events?.errorTotal ?? 0),
        byType: {}, // Would need additional query to break down by error type
      },
    };
  }

  /**
   * Get recent run history
   */
  async getRunHistory(limit: number = 10): Promise<Array<{
    id: string;
    runId: string;
    runType: string;
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    policiesChecked: number;
    alertsCreated: number;
    errorsEncountered: number;
    duration: number | null;
  }>> {
    const runs = await db
      .select({
        id: riskMonitorActivityLog.id,
        runId: riskMonitorActivityLog.runId,
        runType: riskMonitorActivityLog.runType,
        status: riskMonitorActivityLog.status,
        startedAt: riskMonitorActivityLog.startedAt,
        completedAt: riskMonitorActivityLog.completedAt,
        policiesChecked: riskMonitorActivityLog.policiesChecked,
        alertsCreated: riskMonitorActivityLog.alertsCreated,
        errorsEncountered: riskMonitorActivityLog.errorsEncountered,
      })
      .from(riskMonitorActivityLog)
      .where(eq(riskMonitorActivityLog.tenantId, this.tenantId))
      .orderBy(desc(riskMonitorActivityLog.startedAt))
      .limit(limit);

    return runs.map((run) => ({
      id: run.id,
      runId: run.runId,
      runType: run.runType ?? "scheduled",
      status: run.status ?? "unknown",
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      policiesChecked: run.policiesChecked ?? 0,
      alertsCreated: run.alertsCreated ?? 0,
      errorsEncountered: run.errorsEncountered ?? 0,
      duration: run.completedAt && run.startedAt
        ? run.completedAt.getTime() - run.startedAt.getTime()
        : null,
    }));
  }

  /**
   * Get property status distribution
   */
  async getStatusDistribution(): Promise<Record<string, number>> {
    const stats = await db
      .select({
        status: riskMonitorPolicies.currentStatus,
        count: sql<number>`COUNT(*)`,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, this.tenantId),
          eq(riskMonitorPolicies.isActive, true)
        )
      )
      .groupBy(riskMonitorPolicies.currentStatus);

    const distribution: Record<string, number> = {};
    for (const row of stats) {
      distribution[row.status ?? "unknown"] = Number(row.count);
    }

    return distribution;
  }

  /**
   * Get confidence score distribution for recent alerts
   */
  async getConfidenceDistribution(days: number = 30): Promise<{
    high: number;    // >= 0.8
    medium: number;  // 0.6 - 0.8
    low: number;     // < 0.6
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const alerts = await db
      .select({
        rawData: riskMonitorAlerts.rawData,
      })
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, this.tenantId),
          sql`${riskMonitorAlerts.createdAt} >= ${startDate}`
        )
      );

    let high = 0, medium = 0, low = 0;

    for (const alert of alerts) {
      const rawData = alert.rawData as { confidence?: { score?: number } } | null;
      const score = rawData?.confidence?.score ?? 0;

      if (score >= 0.8) {
        high++;
      } else if (score >= 0.6) {
        medium++;
      } else {
        low++;
      }
    }

    return { high, medium, low };
  }
}

// Factory function to create scheduler instance
export function createRiskMonitorScheduler(tenantId: string): RiskMonitorScheduler {
  return new RiskMonitorScheduler(tenantId);
}
