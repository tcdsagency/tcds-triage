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
import { eq, and, lte, sql, isNull, or, desc } from "drizzle-orm";

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
        delayBetweenChecksMs: 30000,
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
      delayBetweenChecksMs: record.delayBetweenChecksMs ?? 30000,
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
   */
  async getMortgageesToCheck(): Promise<(typeof mortgagees.$inferSelect)[]> {
    if (!this.settings) return [];

    const checkIntervalMs = this.settings.recheckDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - checkIntervalMs);

    // Get remaining budget for today
    const remainingBudget = Math.max(
      0,
      this.settings.dailyCheckBudget - this.settings.checksToday
    );

    if (remainingBudget === 0) {
      console.log("[MortgageeScheduler] Daily budget exhausted");
      return [];
    }

    const rows = await db
      .select({ mortgagee: mortgagees })
      .from(mortgagees)
      .innerJoin(policies, eq(policies.id, mortgagees.policyId))
      .where(
        and(
          eq(mortgagees.tenantId, this.tenantId),
          eq(mortgagees.isActive, true),
          eq(policies.status, "active"),
          or(
            isNull(mortgagees.lastPaymentCheckAt),
            lte(mortgagees.lastPaymentCheckAt, cutoffDate)
          )
        )
      )
      .orderBy(mortgagees.lastPaymentCheckAt) // Check oldest first
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

    // Load settings
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

        // Delay between checks
        if (this.settings.delayBetweenChecksMs > 0) {
          await new Promise((r) =>
            setTimeout(r, this.settings!.delayBetweenChecksMs)
          );
        }
      }

      // Update activity log
      await db
        .update(mortgageePaymentActivityLog)
        .set({
          status: "completed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          policiesChecked,
          latePaymentsFound,
          lapsedFound,
          errorsEncountered: errors,
        })
        .where(eq(mortgageePaymentActivityLog.id, logRecord.id));

      // Update settings with last run info
      await db
        .update(mortgageePaymentSettings)
        .set({
          lastSchedulerRunAt: new Date(startTime),
          lastSchedulerCompletedAt: new Date(),
          schedulerRunCount: sql`${mortgageePaymentSettings.schedulerRunCount} + 1`,
        })
        .where(eq(mortgageePaymentSettings.tenantId, this.tenantId));
    } catch (error: any) {
      console.error("[MortgageeScheduler] Run error:", error);

      await db
        .update(mortgageePaymentActivityLog)
        .set({
          status: "failed",
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          policiesChecked,
          latePaymentsFound,
          lapsedFound,
          errorsEncountered: errors + 1,
          errorMessage: error.message,
        })
        .where(eq(mortgageePaymentActivityLog.id, logRecord.id));

      await db
        .update(mortgageePaymentSettings)
        .set({
          lastSchedulerError: error.message,
        })
        .where(eq(mortgageePaymentSettings.tenantId, this.tenantId));
    } finally {
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

    const zipCode = property?.address?.zip || "";
    const loanNumber = mortgagee.loanNumber || policy?.policyNumber || "";

    // Get customer last name for MCI lookup
    let lastName = "";
    if (mortgagee.customerId) {
      const [customer] = await db
        .select({ lastName: customers.lastName })
        .from(customers)
        .where(eq(customers.id, mortgagee.customerId))
        .limit(1);
      lastName = customer?.lastName || "";
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
          errorMessage: result.error_message,
          errorCode: result.error_code,
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
