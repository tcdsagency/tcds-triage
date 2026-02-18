/**
 * Mortgagee Payment Scheduler
 *
 * Follows the RiskMonitorScheduler pattern for batch processing of
 * mortgagee payment status checks.
 */

import { db } from "@/db";
import {
  mortgagees,
  mortgageePaymentChecks,
  mortgageePaymentSettings,
  mortgageePaymentActivityLog,
  policies,
  properties,
  customers,
} from "@/db/schema";
import { eq, and, lte, gte, sql, isNull, or, not, desc } from "drizzle-orm";

/**
 * Mortgage companies confirmed to NOT use MCI.
 * These will be skipped during checks to avoid unnecessary API calls.
 * Patterns are matched case-insensitively against the mortgagee name.
 */
export const MCI_SKIP_PATTERNS = [
  "freedom mortgage",
  "servisolutions",
  "servi solutions",
  "al housing",
  "alabama housing",
  "hometown bank",
  "southern energy",
];

/**
 * Check if a mortgagee company should skip MCI lookup.
 * Returns true if the company is known to not use MCI.
 */
export function shouldSkipMci(mortgageeName: string): boolean {
  const lower = (mortgageeName || "").toLowerCase();
  return MCI_SKIP_PATTERNS.some((pattern) => lower.includes(pattern));
}

interface SchedulerSettings {
  enabled: boolean;
  recheckDays: number;
  windowStartHour: number;
  windowEndHour: number;
  dailyCheckBudget: number;
  checksToday: number;
  delayBetweenChecksMs: number;
  microserviceUrl: string;
  microserviceApiKey: string;
  alertOnLatePayment: boolean;
  alertOnLapsed: boolean;
  emailNotificationsEnabled: boolean;
  emailRecipients: string[];
}

interface CheckResult {
  mortgageeId: string;
  policyNumber: string;
  success: boolean;
  paymentStatus?: string;
  error?: string;
}

interface SchedulerRunResult {
  success: boolean;
  runId: string;
  policiesChecked: number;
  latePaymentsFound: number;
  lapsedFound: number;
  errors: number;
  duration: number;
  stoppedReason?: string;
}

export class MortgageePaymentScheduler {
  private tenantId: string;
  private settings: SchedulerSettings | null = null;
  private isRunning: boolean = false;
  private currentRunId: string | null = null;
  private currentLogId: string | null = null;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async loadSettings(): Promise<SchedulerSettings> {
    const [record] = await db
      .select()
      .from(mortgageePaymentSettings)
      .where(eq(mortgageePaymentSettings.tenantId, this.tenantId))
      .limit(1);

    if (!record) {
      return {
        enabled: false,
        recheckDays: 7,
        windowStartHour: 22,
        windowEndHour: 5,
        dailyCheckBudget: 200,
        checksToday: 0,
        delayBetweenChecksMs: 10000,
        microserviceUrl: "",
        microserviceApiKey: "",
        alertOnLatePayment: true,
        alertOnLapsed: true,
        emailNotificationsEnabled: false,
        emailRecipients: [],
      };
    }

    return {
      enabled: !record.isPaused,
      recheckDays: record.recheckDays ?? 7,
      windowStartHour: record.scheduleStartHour ?? 22,
      windowEndHour: record.scheduleEndHour ?? 5,
      dailyCheckBudget: record.dailyCheckBudget ?? 200,
      checksToday: record.checksToday ?? 0,
      delayBetweenChecksMs: record.delayBetweenChecksMs ?? 10000,
      microserviceUrl: record.microserviceUrl ?? "",
      microserviceApiKey: record.microserviceApiKey ?? "",
      alertOnLatePayment: record.alertOnLatePayment ?? true,
      alertOnLapsed: record.alertOnLapsed ?? true,
      emailNotificationsEnabled: record.emailNotificationsEnabled ?? false,
      emailRecipients: (record.emailRecipients as string[]) ?? [],
    };
  }

  /**
   * Check if current time is within the allowed schedule window.
   * Default: 10pm - 5am CST
   */
  isWithinWindow(): boolean {
    if (!this.settings) return false;

    const now = new Date();
    // CST is UTC-6, but during DST it's CDT (UTC-5)
    // For simplicity, we'll use a fixed offset of -6
    const cstOffset = -6;
    const utcHour = now.getUTCHours();
    const cstHour = (utcHour + cstOffset + 24) % 24;

    const { windowStartHour, windowEndHour } = this.settings;

    // Handle overnight window (e.g., 22:00 to 05:00)
    if (windowStartHour > windowEndHour) {
      return cstHour >= windowStartHour || cstHour < windowEndHour;
    }

    return cstHour >= windowStartHour && cstHour < windowEndHour;
  }

  /**
   * Get mortgagees that need to be checked.
   * Only selects mortgagees whose policy is within the 120-day renewal window
   * (60 days before and after expiration). Skips mortgagees already confirmed
   * "current" during the current policy term.
   */
  async getMortgageesToCheck(): Promise<(typeof mortgagees.$inferSelect)[]> {
    if (!this.settings) return [];

    // Get remaining budget for today
    const remainingBudget = Math.max(
      0,
      this.settings.dailyCheckBudget - this.settings.checksToday
    );

    if (remainingBudget === 0) {
      console.log("[MortgageeScheduler] Daily budget exhausted");
      return [];
    }

    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // Only check home-type policies — auto lienholders are not in MCI
    const homeLOBs = ["HOME", "DFIRE", "MHOME", "FLOOD"];

    // Build skip patterns filter to exclude non-MCI companies at query level
    const skipConditions = MCI_SKIP_PATTERNS.map(
      (p) => sql`LOWER(${mortgagees.name}) NOT LIKE ${"%" + p + "%"}`
    );

    const rows = await db
      .select({ mortgagee: mortgagees })
      .from(mortgagees)
      .innerJoin(policies, eq(policies.id, mortgagees.policyId))
      .where(
        and(
          eq(mortgagees.tenantId, this.tenantId),
          eq(mortgagees.isActive, true),
          eq(policies.status, "active"),
          // Only home/dwelling/flood policies — skip auto, boat, commercial, etc.
          sql`${policies.lineOfBusiness} IN (${sql.join(homeLOBs.map(l => sql`${l}`), sql`, `)})`,
          // Policy is within 120-day renewal window (±60 days of expiration)
          gte(policies.expirationDate, sixtyDaysAgo),
          lte(policies.expirationDate, sixtyDaysFromNow),
          // Skip if already confirmed current this policy term
          or(
            sql`${mortgagees.currentPaymentStatus} != 'current'`,
            isNull(mortgagees.lastPaymentCheckAt),
            sql`${mortgagees.lastPaymentCheckAt} < ${policies.effectiveDate}`
          ),
          // Must have a loan number — MCI requires it
          sql`${mortgagees.loanNumber} IS NOT NULL AND ${mortgagees.loanNumber} != ''`,
          // Exclude companies not in MCI
          ...skipConditions
        )
      )
      .orderBy(policies.expirationDate) // Prioritize nearest expirations
      .limit(remainingBudget);

    return rows.map((r) => r.mortgagee);
  }

  /**
   * Main run method - executes the scheduler.
   */
  async run(): Promise<SchedulerRunResult> {
    const startTime = Date.now();
    let policiesChecked = 0;
    let latePaymentsFound = 0;
    let lapsedFound = 0;
    let errors = 0;
    let stoppedReason: string | undefined;
    let runError: string | undefined;

    // Load settings
    this.settings = await this.loadSettings();

    // Reset daily budget if it's a new day
    await this.resetBudgetIfNeeded();
    // Reload settings after potential reset
    this.settings = await this.loadSettings();

    if (!this.settings.enabled) {
      return {
        success: false,
        runId: "",
        policiesChecked: 0,
        latePaymentsFound: 0,
        lapsedFound: 0,
        errors: 0,
        duration: 0,
        stoppedReason: "Scheduler is disabled",
      };
    }

    if (!this.isWithinWindow()) {
      return {
        success: false,
        runId: "",
        policiesChecked: 0,
        latePaymentsFound: 0,
        lapsedFound: 0,
        errors: 0,
        duration: 0,
        stoppedReason: "Outside of scheduled time window",
      };
    }

    if (this.isRunning) {
      return {
        success: false,
        runId: "",
        policiesChecked: 0,
        latePaymentsFound: 0,
        lapsedFound: 0,
        errors: 0,
        duration: 0,
        stoppedReason: "Scheduler is already running",
      };
    }

    if (!this.settings.microserviceUrl) {
      return {
        success: false,
        runId: "",
        policiesChecked: 0,
        latePaymentsFound: 0,
        lapsedFound: 0,
        errors: 0,
        duration: 0,
        stoppedReason: "Microservice URL not configured",
      };
    }

    this.isRunning = true;
    const runId = crypto.randomUUID();
    this.currentRunId = runId;

    // Create activity log record
    const [logRecord] = await db
      .insert(mortgageePaymentActivityLog)
      .values({
        tenantId: this.tenantId,
        runId,
        runType: "scheduled",
        status: "running",
        startedAt: new Date(),
      })
      .returning({ id: mortgageePaymentActivityLog.id });

    this.currentLogId = logRecord.id;

    try {
      // Get mortgagees to check
      const mortgageesToCheck = await this.getMortgageesToCheck();

      console.log(
        `[MortgageeScheduler] Found ${mortgageesToCheck.length} mortgagees to check`
      );

      for (const mortgagee of mortgageesToCheck) {
        // Check if still within window
        if (!this.isWithinWindow()) {
          stoppedReason = "Time window closed";
          console.log("[MortgageeScheduler] Time window closed, stopping run");
          break;
        }

        const result = await this.checkMortgagee(mortgagee);
        policiesChecked++;

        if (result.paymentStatus === "late") latePaymentsFound++;
        if (result.paymentStatus === "lapsed") lapsedFound++;
        if (!result.success) errors++;

        // Update today's check count
        await this.incrementChecksToday();

        // Update activity log incrementally so progress is visible
        await db
          .update(mortgageePaymentActivityLog)
          .set({
            policiesChecked,
            latePaymentsFound,
            lapsedFound,
            errorsEncountered: errors,
            durationMs: Date.now() - startTime,
          })
          .where(eq(mortgageePaymentActivityLog.id, logRecord.id));

        // Delay between checks
        if (this.settings.delayBetweenChecksMs > 0) {
          await new Promise((r) =>
            setTimeout(r, this.settings!.delayBetweenChecksMs)
          );
        }
      }
    } catch (error: any) {
      console.error("[MortgageeScheduler] Run error:", error);
      runError = error.message;
    } finally {
      // Always update activity log to completed/failed — even on timeout
      try {
        await db
          .update(mortgageePaymentActivityLog)
          .set({
            status: runError ? "failed" : "completed",
            completedAt: new Date(),
            durationMs: Date.now() - startTime,
            policiesChecked,
            latePaymentsFound,
            lapsedFound,
            errorsEncountered: errors + (runError ? 1 : 0),
            errorMessage: runError || null,
          })
          .where(eq(mortgageePaymentActivityLog.id, logRecord.id));

        await db
          .update(mortgageePaymentSettings)
          .set({
            lastSchedulerRunAt: new Date(startTime),
            lastSchedulerCompletedAt: new Date(),
            schedulerRunCount: sql`${mortgageePaymentSettings.schedulerRunCount} + 1`,
            ...(runError ? { lastSchedulerError: runError } : {}),
          })
          .where(eq(mortgageePaymentSettings.tenantId, this.tenantId));
      } catch (finalErr) {
        console.error("[MortgageeScheduler] Failed to update activity log:", finalErr);
      }

      this.isRunning = false;
      this.currentRunId = null;
      this.currentLogId = null;
    }

    return {
      success: errors === 0,
      runId,
      policiesChecked,
      latePaymentsFound,
      lapsedFound,
      errors,
      duration: Date.now() - startTime,
      stoppedReason,
    };
  }

  /**
   * Check a single mortgagee's payment status.
   */
  private async checkMortgagee(
    mortgagee: typeof mortgagees.$inferSelect
  ): Promise<CheckResult> {
    // Get policy for policy number
    const [policy] = await db
      .select()
      .from(policies)
      .where(eq(policies.id, mortgagee.policyId))
      .limit(1);

    // Get property for ZIP code
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.policyId, mortgagee.policyId))
      .limit(1);

    // Address zip may be at top level or nested under street (HawkSoft sync variant)
    const addr = property?.address as any;
    let zipCode =
      addr?.zip || addr?.street?.zip || "";
    const loanNumber = mortgagee.loanNumber || policy?.policyNumber || "";

    // Get customer last name and address fallback for MCI lookup
    let lastName = "";
    if (mortgagee.customerId) {
      const [customer] = await db
        .select({ lastName: customers.lastName, address: customers.address })
        .from(customers)
        .where(eq(customers.id, mortgagee.customerId))
        .limit(1);
      lastName = customer?.lastName || "";
      // Fallback to customer address ZIP if property ZIP is missing
      if (!zipCode) {
        const custAddr = customer?.address as any;
        zipCode = custAddr?.zip || "";
      }
    }

    // Final fallback to mortgagee's own ZIP
    if (!zipCode) {
      zipCode = mortgagee.zipCode || "";
    }

    // Skip companies that don't use MCI
    if (shouldSkipMci(mortgagee.name || "")) {
      console.log(
        `[MortgageeScheduler] Skipping ${mortgagee.name} - not in MCI`
      );
      // Update mortgagee with skip status
      await db
        .update(mortgagees)
        .set({
          currentPaymentStatus: "not_in_mci",
          lastPaymentCheckAt: new Date(),
          mciLastFound: false,
          updatedAt: new Date(),
        })
        .where(eq(mortgagees.id, mortgagee.id));

      return {
        mortgageeId: mortgagee.id,
        policyNumber: policy?.policyNumber || "",
        success: true,
        paymentStatus: "not_in_mci",
      };
    }

    console.log(
      `[MortgageeScheduler] Checking ${mortgagee.name}: loan=${loanNumber}, zip=${zipCode}, lastName=${lastName}`
    );

    if (!zipCode || !lastName) {
      console.warn(
        `[MortgageeScheduler] Missing data for ${mortgagee.name}: zip=${zipCode}, lastName=${lastName}`
      );
    }

    // Create check record
    const [checkRecord] = await db
      .insert(mortgageePaymentChecks)
      .values({
        tenantId: this.tenantId,
        mortgageeId: mortgagee.id,
        policyId: mortgagee.policyId,
        runId: this.currentRunId,
        checkType: "scheduled",
        status: "in_progress",
        startedAt: new Date(),
      })
      .returning();

    try {
      // Call microservice
      const response = await fetch(
        `${this.settings!.microserviceUrl}/api/v1/check`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.settings!.microserviceApiKey,
          },
          body: JSON.stringify({
            loan_number: loanNumber.replace(/-/g, ""),
            zip_code: zipCode.replace(/-.*$/, ""),
            last_name: lastName || null,
          }),
        }
      );

      const result = await response.json();

      // Handle microservice validation errors (e.g. {error: "zip_code is required"})
      if (!response.ok || result.error) {
        const errMsg = result.error_message || result.error || `HTTP ${response.status}`;
        console.error(`[MortgageeScheduler] Microservice error for ${mortgagee.name}: ${errMsg}`);
        await db
          .update(mortgageePaymentChecks)
          .set({
            status: "failed",
            errorMessage: errMsg,
            errorCode: result.error_code || `HTTP_${response.status}`,
            completedAt: new Date(),
          })
          .where(eq(mortgageePaymentChecks.id, checkRecord.id));

        return {
          mortgageeId: mortgagee.id,
          policyNumber: policy?.policyNumber || "",
          success: false,
          error: errMsg,
        };
      }

      // Update check record
      await db
        .update(mortgageePaymentChecks)
        .set({
          status: result.success ? "completed" : "failed",
          paymentStatus: result.payment_status,
          paidThroughDate: result.paid_through_date,
          nextDueDate: result.next_due_date,
          amountDue: result.amount_due?.toString(),
          premiumAmount: result.premium_amount?.toString(),
          mciPolicyNumber: result.policy_number,
          mciCarrier: result.carrier,
          mciEffectiveDate: result.effective_date,
          mciExpirationDate: result.expiration_date,
          mciCancellationDate: result.cancellation_date,
          mciReason: result.cancellation_reason,
          paymentScreenshotUrl: result.payment_screenshot_url || null,
          rawResponse: result.raw_data || result,
          errorMessage: result.error_message || result.error || null,
          errorCode: result.error_code || null,
          completedAt: new Date(),
          durationMs: result.duration_ms,
        })
        .where(eq(mortgageePaymentChecks.id, checkRecord.id));

      // Update mortgagee status
      await db
        .update(mortgagees)
        .set({
          currentPaymentStatus: result.payment_status || "unknown",
          lastPaymentCheckAt: new Date(),
          mciLastFound: result.success,
          mciPolicyNumber: result.policy_number,
          paidThroughDate: result.paid_through_date,
          nextDueDate: result.next_due_date,
          amountDue: result.amount_due?.toString(),
          updatedAt: new Date(),
        })
        .where(eq(mortgagees.id, mortgagee.id));

      return {
        mortgageeId: mortgagee.id,
        policyNumber: policy?.policyNumber || "",
        success: result.success,
        paymentStatus: result.payment_status,
      };
    } catch (error: any) {
      // Update check record with error
      await db
        .update(mortgageePaymentChecks)
        .set({
          status: "failed",
          errorMessage: error.message,
          errorCode: "MICROSERVICE_ERROR",
          completedAt: new Date(),
        })
        .where(eq(mortgageePaymentChecks.id, checkRecord.id));

      return {
        mortgageeId: mortgagee.id,
        policyNumber: policy?.policyNumber || "",
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reset the daily budget counter if the last reset was not today.
   */
  private async resetBudgetIfNeeded(): Promise<void> {
    const [settings] = await db
      .select({
        lastBudgetResetAt: mortgageePaymentSettings.lastBudgetResetAt,
      })
      .from(mortgageePaymentSettings)
      .where(eq(mortgageePaymentSettings.tenantId, this.tenantId))
      .limit(1);

    if (!settings) return;

    const now = new Date();
    const lastReset = settings.lastBudgetResetAt;

    // Reset if never reset or last reset was a different day (UTC)
    const needsReset =
      !lastReset ||
      lastReset.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);

    if (needsReset) {
      console.log("[MortgageeScheduler] Resetting daily budget counter");
      await db
        .update(mortgageePaymentSettings)
        .set({
          checksToday: 0,
          lastBudgetResetAt: now,
        })
        .where(eq(mortgageePaymentSettings.tenantId, this.tenantId));
    }
  }

  /**
   * Increment the daily check counter.
   */
  private async incrementChecksToday(): Promise<void> {
    await db
      .update(mortgageePaymentSettings)
      .set({
        checksToday: sql`${mortgageePaymentSettings.checksToday} + 1`,
      })
      .where(eq(mortgageePaymentSettings.tenantId, this.tenantId));
  }
}

/**
 * Create a new scheduler instance.
 */
export function createMortgageePaymentScheduler(
  tenantId: string
): MortgageePaymentScheduler {
  return new MortgageePaymentScheduler(tenantId);
}
