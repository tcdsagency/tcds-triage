// =============================================================================
// Daily Reconciliation Cron — catches orphaned/stuck/failed triage items
// Runs at 7 AM CST (0 13 * * * UTC) via Vercel cron
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, wrapupDrafts, pendingTranscriptJobs, apiRetryQueue } from "@/db/schema";
import { eq, and, gte, lte, isNull, or } from "drizzle-orm";
import { outlookClient } from "@/lib/outlook";

interface ReconciliationIssue {
  category: string;
  count: number;
  details: string[];
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[Reconciliation] No valid cron auth header");
  }

  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ success: false, error: "No tenant configured" }, { status: 500 });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    const issues: ReconciliationIssue[] = [];

    // 1. Orphaned calls — completed calls from last 24h with no wrapup draft
    const orphanedCalls = await db
      .select({
        id: calls.id,
        fromNumber: calls.fromNumber,
        externalNumber: calls.externalNumber,
        extension: calls.extension,
        startedAt: calls.startedAt,
        direction: calls.direction,
      })
      .from(calls)
      .leftJoin(wrapupDrafts, eq(calls.id, wrapupDrafts.callId))
      .where(
        and(
          eq(calls.tenantId, tenantId),
          eq(calls.status, "completed"),
          gte(calls.createdAt, twentyFourHoursAgo),
          isNull(wrapupDrafts.id)
        )
      )
      .limit(50);

    if (orphanedCalls.length > 0) {
      issues.push({
        category: "Orphaned Calls (no wrapup)",
        count: orphanedCalls.length,
        details: orphanedCalls.map(c => {
          const phone = c.externalNumber || c.fromNumber || "Unknown";
          const time = c.startedAt
            ? new Date(c.startedAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })
            : "?";
          return `${c.direction} from ${phone} at ${time} (ext ${c.extension || "?"})`;
        }),
      });
    }

    // 2. Stuck wrapups — pending_ai_processing or pending_review for >8 hours
    const stuckWrapups = await db
      .select({
        id: wrapupDrafts.id,
        status: wrapupDrafts.status,
        customerPhone: wrapupDrafts.customerPhone,
        customerName: wrapupDrafts.customerName,
        createdAt: wrapupDrafts.createdAt,
      })
      .from(wrapupDrafts)
      .where(
        and(
          eq(wrapupDrafts.tenantId, tenantId),
          or(
            eq(wrapupDrafts.status, "pending_ai_processing"),
            eq(wrapupDrafts.status, "pending_review")
          ),
          lte(wrapupDrafts.createdAt, eightHoursAgo)
        )
      )
      .limit(50);

    if (stuckWrapups.length > 0) {
      issues.push({
        category: "Stuck Wrapups (>8 hours)",
        count: stuckWrapups.length,
        details: stuckWrapups.map(w => {
          const ageHours = Math.round((now.getTime() - new Date(w.createdAt).getTime()) / 3600000);
          return `${w.customerName || w.customerPhone || "Unknown"} — ${w.status} for ${ageHours}h`;
        }),
      });
    }

    // 3. Failed transcript jobs in last 24h
    const failedJobs = await db
      .select({
        id: pendingTranscriptJobs.id,
        callerNumber: pendingTranscriptJobs.callerNumber,
        agentExtension: pendingTranscriptJobs.agentExtension,
        failedAt: pendingTranscriptJobs.failedAt,
        error: pendingTranscriptJobs.error,
      })
      .from(pendingTranscriptJobs)
      .where(
        and(
          eq(pendingTranscriptJobs.status, "failed"),
          gte(pendingTranscriptJobs.failedAt, twentyFourHoursAgo)
        )
      )
      .limit(50);

    if (failedJobs.length > 0) {
      issues.push({
        category: "Failed Transcript Jobs",
        count: failedJobs.length,
        details: failedJobs.map(j => {
          const time = j.failedAt
            ? new Date(j.failedAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" })
            : "?";
          return `${j.callerNumber || "Unknown"} (ext ${j.agentExtension || "?"}) at ${time}`;
        }),
      });
    }

    // 4. Failed retry queue items in last 24h
    const failedRetries = await db
      .select({
        id: apiRetryQueue.id,
        operationType: apiRetryQueue.operationType,
        lastError: apiRetryQueue.lastError,
        lastAttemptAt: apiRetryQueue.lastAttemptAt,
      })
      .from(apiRetryQueue)
      .where(
        and(
          eq(apiRetryQueue.tenantId, tenantId),
          eq(apiRetryQueue.status, "failed"),
          gte(apiRetryQueue.createdAt, twentyFourHoursAgo)
        )
      )
      .limit(50);

    if (failedRetries.length > 0) {
      issues.push({
        category: "Failed Retry Queue Items",
        count: failedRetries.length,
        details: failedRetries.map(r => {
          const err = (r.lastError || "unknown error").slice(0, 80);
          return `${r.operationType}: ${err}`;
        }),
      });
    }

    // Send summary email if any issues found
    const totalIssues = issues.reduce((sum, i) => sum + i.count, 0);

    if (totalIssues > 0) {
      const alertEmail = process.env.TRIAGE_ALERT_EMAIL || process.env.OUTLOOK_SENDER_EMAIL;
      if (alertEmail && outlookClient.isConfigured()) {
        const sections = issues.map(issue => {
          const detailList = issue.details.slice(0, 10).map(d => `  - ${d}`).join("<br/>");
          const overflow = issue.count > 10 ? `<br/>  ... and ${issue.count - 10} more` : "";
          return `<b>${issue.category} (${issue.count})</b><br/>${detailList}${overflow}`;
        });

        try {
          await outlookClient.sendEmail({
            to: alertEmail,
            subject: `[TCDS] Daily Reconciliation: ${totalIssues} issue${totalIssues !== 1 ? "s" : ""} found`,
            body: [
              `Daily triage reconciliation report for ${now.toLocaleDateString("en-US", { timeZone: "America/Chicago" })}:`,
              ``,
              ...sections,
              ``,
              `— TCDS Reconciliation`,
            ].join("<br/>"),
            isHtml: true,
          });
          console.log(`[Reconciliation] Summary email sent: ${totalIssues} issues`);
        } catch (emailErr) {
          console.error(`[Reconciliation] Failed to send email:`, emailErr instanceof Error ? emailErr.message : emailErr);
        }
      }
    } else {
      console.log(`[Reconciliation] Clean day — no issues found`);
    }

    return NextResponse.json({
      success: true,
      totalIssues,
      issues: issues.map(i => ({ category: i.category, count: i.count })),
      emailSent: totalIssues > 0,
    });
  } catch (error) {
    console.error("[Reconciliation] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Reconciliation failed" },
      { status: 500 }
    );
  }
}
