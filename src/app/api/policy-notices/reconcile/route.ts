/**
 * API Route: /api/policy-notices/reconcile
 * =========================================
 * Runs reconciliation on existing policy notices.
 *
 * When a "Cancellation Rescinded" notice exists for a policy,
 * any "Pending Cancellation" notices for the same policy should be
 * marked as reviewed/auto_reconciled.
 *
 * This is a one-time cleanup for existing data. New notices will
 * be reconciled automatically during sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policyNotices } from "@/db/schema";
import { eq, and, inArray, lt } from "drizzle-orm";

// Reconciliation rules: resolving notice → notices it should close
const RECONCILIATION_RULES = [
  {
    resolvingTitle: 'Cancellation Rescinded',
    closeTitles: ['Pending Cancellation - Non-Payment'],
  },
  {
    resolvingTitle: 'Policy Reinstatement',
    closeTitles: ['Policy Lapse Notice'],
  },
  {
    resolvingTitle: 'Policy Renewal',
    closeTitles: ['Pending Cancellation - Non-Payment', 'Policy Non-Renewal'],
  },
];

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const results = {
      checked: 0,
      reconciled: 0,
      details: [] as { policy: string; from: string; closedBy: string }[],
    };

    // Process each reconciliation rule
    for (const rule of RECONCILIATION_RULES) {
      // Find all resolving notices (e.g., all "Cancellation Rescinded" notices)
      const resolvingNotices = await db
        .select({
          id: policyNotices.id,
          policyNumber: policyNotices.policyNumber,
          createdAt: policyNotices.createdAt,
          title: policyNotices.title,
        })
        .from(policyNotices)
        .where(
          and(
            eq(policyNotices.tenantId, tenantId),
            eq(policyNotices.title, rule.resolvingTitle)
          )
        );

      results.checked += resolvingNotices.length;

      // For each resolving notice, close older notices with matching policy
      for (const notice of resolvingNotices) {
        if (!notice.policyNumber) continue;

        const updated = await db
          .update(policyNotices)
          .set({
            reviewStatus: 'reviewed',
            actionTaken: 'auto_reconciled',
            actionDetails: `Automatically closed by: ${notice.title} (reconciliation run)`,
            actionedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(policyNotices.tenantId, tenantId),
              eq(policyNotices.policyNumber, notice.policyNumber),
              eq(policyNotices.reviewStatus, 'pending'),
              inArray(policyNotices.title, rule.closeTitles),
              // Only close notices that are older than the resolving notice
              lt(policyNotices.createdAt, notice.createdAt!)
            )
          )
          .returning({
            id: policyNotices.id,
            title: policyNotices.title,
            policyNumber: policyNotices.policyNumber,
          });

        for (const closed of updated) {
          results.reconciled++;
          results.details.push({
            policy: closed.policyNumber || 'unknown',
            from: closed.title || 'unknown',
            closedBy: notice.title,
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[PolicyNotices Reconcile] Completed in ${duration}ms: checked=${results.checked}, reconciled=${results.reconciled}`
    );

    return NextResponse.json({
      success: true,
      ...results,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PolicyNotices Reconcile] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Reconciliation failed",
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// GET for status/info
export async function GET() {
  return NextResponse.json({
    description: "Policy Notice Reconciliation",
    rules: RECONCILIATION_RULES.map(r => ({
      when: r.resolvingTitle,
      closes: r.closeTitles,
    })),
    usage: "POST to this endpoint to run reconciliation on existing notices",
  });
}
