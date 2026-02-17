/**
 * API Route: /api/policy-notices/sync
 * ====================================
 * Polls Adapt Insurance API for new notices and stores them.
 * Called by Vercel Cron every 4 hours.
 *
 * Enhanced with:
 * - Priority scoring (0-100) for call queue prioritization
 * - Donna AI context generation (talking points, objection handlers)
 * - Customer value calculation (total active premiums)
 * - Match confidence levels (high/medium/none)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policyNotices, customers, policies } from "@/db/schema";
import { eq, and, ilike, or, sum, ne, inArray } from "drizzle-orm";
import {
  getAdaptInsuranceClient,
  getMockNotices,
  NormalizedNotice,
} from "@/lib/api/adapt-insurance";
import { calculatePriorityScore } from "@/lib/utils/priority-scoring";
import { generateDonnaContext } from "@/lib/api/donna-context";

// =============================================================================
// RECONCILIATION RULES
// =============================================================================
// When certain notices arrive, they resolve/supersede previous notices:
// - CANCEL_RESCIND → Closes PENDING_CANCELLATION (carrier reversed the cancellation)
// - REINSTATEMENT → Closes LAPSE_NOTICE (policy was reinstated)
// - RENEWAL → Closes PENDING_CANCELLATION and NON_RENEWAL (customer renewed/paid)

const RECONCILIATION_MAP: Record<string, string[]> = {
  'Cancellation Rescinded': ['Pending Cancellation - Non-Payment'],
  'Policy Reinstatement': ['Policy Lapse Notice'],
  'Policy Renewal': ['Pending Cancellation - Non-Payment', 'Policy Non-Renewal'],
};

/**
 * Reconcile related notices when a resolving notice arrives.
 * Marks superseded notices as "reviewed" with action "auto_reconciled".
 */
async function reconcileRelatedNotices(
  tenantId: string,
  policyNumber: string,
  newNoticeTitle: string
): Promise<number> {
  const titlesToClose = RECONCILIATION_MAP[newNoticeTitle];
  if (!titlesToClose || !policyNumber) return 0;

  // Find and update pending notices with matching policy number
  const updated = await db
    .update(policyNotices)
    .set({
      reviewStatus: 'reviewed',
      actionTaken: 'auto_reconciled',
      actionDetails: `Automatically closed by: ${newNoticeTitle}`,
      actionedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(policyNotices.tenantId, tenantId),
        eq(policyNotices.policyNumber, policyNumber),
        eq(policyNotices.reviewStatus, 'pending'),
        inArray(policyNotices.title, titlesToClose)
      )
    )
    .returning({ id: policyNotices.id });

  if (updated.length > 0) {
    console.log(
      `[PolicyNotices Sync] Reconciled ${updated.length} notice(s) for policy ${policyNumber} due to: ${newNoticeTitle}`
    );
  }

  return updated.length;
}

// =============================================================================
// POST - Sync Notices from Adapt API
// =============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Optional: verify cron secret for security
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Allow manual trigger without auth for testing
      const { searchParams } = new URL(request.url);
      if (!searchParams.get("manual")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const client = getAdaptInsuranceClient();

    let normalizedNotices: NormalizedNotice[];

    if (client.isConfigured()) {
      // Fetch from real API
      console.log("[PolicyNotices Sync] Fetching from Adapt API...");
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const response = await client.getAllNotices(since);
        normalizedNotices = client.normalizeAllNotices(response);
        console.log(`[PolicyNotices Sync] Fetched ${normalizedNotices.length} notices from API`);
      } catch (apiError) {
        console.error("[PolicyNotices Sync] Adapt API error:", apiError);
        // In production, fail the sync rather than inserting mock data
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
          return NextResponse.json({
            success: false,
            error: 'Adapt API failed',
            details: apiError instanceof Error ? apiError.message : 'Unknown error',
          }, { status: 502 });
        }
        // Only use mock data in development/preview
        console.log("[PolicyNotices Sync] Falling back to mock data (non-production)");
        const mockResponse = getMockNotices();
        normalizedNotices = client.normalizeAllNotices(mockResponse);
      }
    } else {
      // Use mock data for testing
      console.log("[PolicyNotices Sync] API not configured, using mock data");
      const mockResponse = getMockNotices();
      normalizedNotices = client.normalizeAllNotices(mockResponse);
    }

    // Process each notice
    const results = {
      total: normalizedNotices.length,
      created: 0,
      skipped: 0,
      matched: 0,
      reconciled: 0, // Count of notices auto-closed by reconciliation
      errors: 0,
    };
    const errorDetails: { id: string; error: string }[] = [];

    for (const notice of normalizedNotices) {
      try {
        // Check if notice already exists
        const [existing] = await db
          .select({ id: policyNotices.id })
          .from(policyNotices)
          .where(
            and(
              eq(policyNotices.tenantId, tenantId),
              eq(policyNotices.adaptNoticeId, notice.adaptNoticeId)
            )
          )
          .limit(1);

        if (existing) {
          results.skipped++;
          continue;
        }

        // Try to match to existing customer
        let customerId: string | null = null;
        let policyId: string | null = null;

        // Match by insured name (fuzzy)
        if (notice.insuredName) {
          const nameParts = notice.insuredName.split(' ');
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ') || nameParts[0];

          const [matchedCustomer] = await db
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(
                eq(customers.tenantId, tenantId),
                or(
                  and(
                    ilike(customers.firstName, `%${firstName}%`),
                    ilike(customers.lastName, `%${lastName}%`)
                  ),
                  ilike(customers.lastName, `%${notice.insuredName}%`)
                )
              )
            )
            .limit(1);

          if (matchedCustomer) {
            customerId = matchedCustomer.id;
            results.matched++;
          }
        }

        // Match by policy number
        if (notice.policyNumber) {
          const [matchedPolicy] = await db
            .select({ id: policies.id, customerId: policies.customerId })
            .from(policies)
            .where(
              and(
                eq(policies.tenantId, tenantId),
                eq(policies.policyNumber, notice.policyNumber)
              )
            )
            .limit(1);

          if (matchedPolicy) {
            policyId = matchedPolicy.id;
            if (!customerId && matchedPolicy.customerId) {
              customerId = matchedPolicy.customerId;
              results.matched++;
            }
          }
        }

        // Enhanced matching: Try phone if still no customer match
        if (!customerId) {
          const phone = (notice.rawPayload as Record<string, unknown>)?.phone as string;
          if (phone) {
            const normalizedPhone = phone.replace(/\D/g, '');
            const [byPhone] = await db
              .select({ id: customers.id })
              .from(customers)
              .where(
                and(
                  eq(customers.tenantId, tenantId),
                  eq(customers.phone, normalizedPhone)
                )
              )
              .limit(1);
            if (byPhone) {
              customerId = byPhone.id;
              results.matched++;
            }
          }
        }

        // Enhanced matching: Try email if still no customer match
        if (!customerId) {
          const email = (notice.rawPayload as Record<string, unknown>)?.email as string;
          if (email) {
            const [byEmail] = await db
              .select({ id: customers.id })
              .from(customers)
              .where(
                and(
                  eq(customers.tenantId, tenantId),
                  ilike(customers.email, email)
                )
              )
              .limit(1);
            if (byEmail) {
              customerId = byEmail.id;
              results.matched++;
            }
          }
        }

        // Determine match confidence
        const matchConfidence = customerId && policyId ? 'high'
          : (customerId || policyId) ? 'medium'
          : 'none';

        // Calculate customer value (total active premiums)
        let customerValue: number | null = null;
        if (customerId) {
          const premiumResult = await db
            .select({ total: sum(policies.premium) })
            .from(policies)
            .where(
              and(
                eq(policies.customerId, customerId),
                eq(policies.status, 'active')
              )
            );
          customerValue = premiumResult[0]?.total ? Number(premiumResult[0].total) : null;
        }

        // Calculate days until due
        const daysUntilDue = notice.dueDate
          ? Math.floor((new Date(notice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

        // Calculate priority score
        const priorityScore = calculatePriorityScore({
          noticeType: notice.noticeType,
          urgency: notice.urgency,
          daysUntilDue,
          amountDue: notice.amountDue ? parseFloat(notice.amountDue) : null,
          customerValue,
          claimStatus: notice.claimStatus,
        });

        // Generate Donna AI context for high-priority notices
        const donnaContext = priorityScore >= 70
          ? generateDonnaContext(
              notice.noticeType,
              notice.amountDue,
              notice.dueDate,
              notice.claimStatus,
              notice.insuredName
            )
          : null;

        // Insert the notice
        await db.insert(policyNotices).values({
          tenantId,
          adaptNoticeId: notice.adaptNoticeId,
          noticeType: notice.noticeType,
          urgency: notice.urgency,
          policyNumber: notice.policyNumber,
          insuredName: notice.insuredName,
          carrier: notice.carrier,
          lineOfBusiness: notice.lineOfBusiness,
          customerId,
          policyId,
          title: notice.title,
          description: notice.description,
          documentUrl: notice.documentUrl,
          documentFileName: notice.documentFileName,
          amountDue: notice.amountDue ? notice.amountDue.replace(/[^0-9.-]/g, '') || null : null,
          dueDate: notice.dueDate,
          gracePeriodEnd: notice.gracePeriodEnd,
          claimNumber: notice.claimNumber,
          claimDate: notice.claimDate,
          claimStatus: notice.claimStatus,
          rawPayload: notice.rawPayload,
          noticeDate: notice.noticeDate,
          fetchedAt: new Date(),
          // Enhanced fields
          priorityScore,
          donnaContext,
          customerValue: customerValue?.toString() ?? null,
          matchConfidence,
        });

        results.created++;

        // Reconcile related notices (e.g., rescission closes pending cancellation)
        const reconciledCount = await reconcileRelatedNotices(
          tenantId,
          notice.policyNumber,
          notice.title
        );
        results.reconciled += reconciledCount;
      } catch (noticeError) {
        const errorMsg = noticeError instanceof Error ? noticeError.message : String(noticeError);
        console.error(
          `[PolicyNotices Sync] Error processing notice ${notice.adaptNoticeId}:`,
          errorMsg
        );
        errorDetails.push({ id: notice.adaptNoticeId, error: errorMsg });
        results.errors++;
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[PolicyNotices Sync] Completed in ${duration}ms:`,
      JSON.stringify(results)
    );

    return NextResponse.json({
      success: true,
      results,
      duration,
      timestamp: new Date().toISOString(),
      ...(errorDetails.length > 0 && { errorDetails: errorDetails.slice(0, 10) }), // First 10 errors
    });
  } catch (error) {
    console.error("[PolicyNotices Sync] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggering and status check
export async function GET() {
  try {
    const client = getAdaptInsuranceClient();

    return NextResponse.json({
      configured: client.isConfigured(),
      message: client.isConfigured()
        ? "Adapt Insurance API is configured. POST to this endpoint to sync notices."
        : "Adapt Insurance API is not configured. Mock data will be used for testing.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed" },
      { status: 500 }
    );
  }
}
