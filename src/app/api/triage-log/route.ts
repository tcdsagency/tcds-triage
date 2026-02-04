// API Route: /api/triage-log
// Returns every call with its triage outcome (joined with wrapup_drafts)
// Deduplicates by externalCallId or phone+time bucket

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, customers, users, wrapupDrafts } from "@/db/schema";
import { desc, eq, and, gte, lte, or, ilike, sql, isNull, isNotNull } from "drizzle-orm";

type TriageAction =
  | "auto_posted"
  | "ticket_created"
  | "lead_created"
  | "auto_voided"
  | "pending"
  | "deleted"
  | "skipped"
  | "no_wrapup";

function computeAction(wrapup: {
  isAutoVoided: boolean | null;
  noteAutoPosted: boolean | null;
  completionAction: string | null;
  outcome: string | null;
  wrapupStatus: string | null;
  agencyzoomTicketId: string | null;
  agencyzoomNoteId: string | null;
  agencyzoomLeadId: string | null;
} | null): TriageAction {
  if (!wrapup) return "no_wrapup";
  if (wrapup.isAutoVoided) return "auto_voided";
  if (wrapup.noteAutoPosted) return "auto_posted";

  // Check completionAction first (set by some code paths)
  if (wrapup.completionAction === "ticket") return "ticket_created";
  if (wrapup.completionAction === "lead") return "lead_created";
  if (wrapup.completionAction === "deleted") return "deleted";
  if (wrapup.completionAction === "skipped") return "skipped";
  if (wrapup.completionAction === "posted") return "auto_posted";
  if (wrapup.completionAction === "voided") return "auto_voided";

  // Fallback: check outcome field (set by other code paths that don't set completionAction)
  if (wrapup.outcome === "ticket_created" || wrapup.outcome === "ticket_appended" || wrapup.outcome === "ticket") return "ticket_created";
  if (wrapup.outcome === "lead_created") return "lead_created";
  if (wrapup.outcome === "note_posted" || wrapup.outcome === "lead_note_posted" || wrapup.outcome === "ncm_posted") return "auto_posted";
  if (wrapup.outcome === "deleted") return "deleted";
  if (wrapup.outcome === "skipped") return "skipped";
  if (wrapup.outcome === "voided") return "auto_voided";

  // Fallback: check if AZ artifacts exist (ticket/note/lead were created but fields weren't set)
  if (wrapup.agencyzoomTicketId) return "ticket_created";
  if (wrapup.agencyzoomLeadId) return "lead_created";
  if (wrapup.agencyzoomNoteId && wrapup.wrapupStatus === "completed") return "auto_posted";

  // Wrapup exists but no completion action yet
  return "pending";
}

// Score a row for dedup "best record" selection
function scoreRow(entry: {
  hasWrapup: boolean;
  customerId: string | null;
  hasTranscript: boolean;
  durationSeconds: number;
  action: TriageAction;
  summary: string | null;
}): number {
  let score = 0;
  if (entry.hasWrapup) score += 100;
  if (entry.customerId) score += 50;
  if (entry.hasTranscript) score += 20;
  if (entry.summary) score += 30;
  // Prefer entries with completed actions over pending/no_wrapup
  if (entry.action === "auto_posted" || entry.action === "ticket_created" || entry.action === "lead_created") score += 200;
  if (entry.action === "auto_voided" || entry.action === "skipped" || entry.action === "deleted") score += 150;
  score += Math.min(entry.durationSeconds, 100); // cap duration contribution
  return score;
}

// Normalize phone to last 10 digits for dedup grouping
function normalizePhone(phone: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-10);
}

// Max gap between records in a dedup cluster (2 minutes)
const DEDUP_GAP_MS = 2 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const direction = searchParams.get("direction");
    const action = searchParams.get("action");
    const agentId = searchParams.get("agentId");
    const dateRange = searchParams.get("dateRange") || "today";
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build date filter
    let startDate: Date | undefined;
    let endDate = new Date();

    switch (dateRange) {
      case "today":
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "7d":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        break;
    }

    // Query calls LEFT JOIN wrapup_drafts
    const rows = await db
      .select({
        // Call fields
        id: calls.id,
        externalCallId: calls.externalCallId,
        direction: calls.directionFinal,
        directionLive: calls.directionLive,
        status: calls.status,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        extension: calls.extension,
        customerId: calls.customerId,
        agentId: calls.agentId,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        aiSummary: calls.aiSummary,
        disposition: calls.disposition,
        agencyzoomNoteId: calls.agencyzoomNoteId,
        recordingUrl: calls.recordingUrl,
        transcription: calls.transcription,
        aiSentiment: calls.aiSentiment,
        qualityScore: calls.qualityScore,
        predictedReason: calls.predictedReason,
        // Customer fields
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        customerPhone: customers.phone,
        // Agent fields
        agentFirstName: users.firstName,
        agentLastName: users.lastName,
        // Wrapup fields
        wrapupId: wrapupDrafts.id,
        wrapupSummary: wrapupDrafts.aiCleanedSummary,
        wrapupCustomerName: wrapupDrafts.customerName,
        wrapupCustomerPhone: wrapupDrafts.customerPhone,
        isAutoVoided: wrapupDrafts.isAutoVoided,
        autoVoidReason: wrapupDrafts.autoVoidReason,
        noteAutoPosted: wrapupDrafts.noteAutoPosted,
        noteAutoPostedAt: wrapupDrafts.noteAutoPostedAt,
        completionAction: wrapupDrafts.completionAction,
        matchStatus: wrapupDrafts.matchStatus,
        agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
        wrapupNoteId: wrapupDrafts.agencyzoomNoteId,
        deleteReason: wrapupDrafts.deleteReason,
        deleteNotes: wrapupDrafts.deleteNotes,
        wrapupStatus: wrapupDrafts.status,
        requestType: wrapupDrafts.requestType,
        ticketType: wrapupDrafts.ticketType,
        leadType: wrapupDrafts.leadType,
        agencyzoomLeadId: wrapupDrafts.agencyzoomLeadId,
        wrapupOutcome: wrapupDrafts.outcome,
        wrapupTrestleData: wrapupDrafts.trestleData,
      })
      .from(calls)
      .leftJoin(wrapupDrafts, eq(calls.id, wrapupDrafts.callId))
      .leftJoin(customers, eq(calls.customerId, customers.id))
      .leftJoin(users, eq(calls.agentId, users.id))
      .where(
        and(
          eq(calls.tenantId, tenantId),
          direction && direction !== "all"
            ? or(
                eq(calls.directionFinal, direction as any),
                eq(calls.directionLive, direction as any)
              )
            : undefined,
          agentId && agentId !== "all" ? eq(calls.agentId, agentId) : undefined,
          startDate ? gte(calls.startedAt, startDate) : undefined,
          endDate ? lte(calls.startedAt, endDate) : undefined,
          search
            ? or(
                ilike(customers.firstName, `%${search}%`),
                ilike(customers.lastName, `%${search}%`),
                ilike(calls.fromNumber, `%${search}%`),
                ilike(calls.toNumber, `%${search}%`),
                ilike(wrapupDrafts.customerName, `%${search}%`)
              )
            : undefined
        )
      )
      .orderBy(desc(calls.startedAt))
      .limit(500); // Fetch more for stats, then paginate

    // Filter out internal / phantom calls
    const isExtensionNumber = (num: string | null) => {
      if (!num) return false;
      const digits = num.replace(/\D/g, "");
      return digits.length > 0 && digits.length <= 4;
    };
    const hasRealPhone = (num: string | null) => {
      if (!num) return false;
      const digits = num.replace(/\D/g, "");
      return digits.length >= 7; // real phone numbers have 7+ digits
    };
    const externalRows = rows.filter((row) => {
      // Skip internal ext-to-ext calls (e.g. 110 -> 103)
      if (isExtensionNumber(row.fromNumber) && isExtensionNumber(row.toNumber)) return false;
      // Skip phantom 3CX events: "Unknown" -> extension, 0s duration, no real caller
      if (!hasRealPhone(row.fromNumber) && !hasRealPhone(row.toNumber) && (row.durationSeconds || 0) === 0) return false;
      return true;
    });

    // Compute action for each row and build entries
    const rawEntries = externalRows.map((row) => {
      const dir = row.direction || row.directionLive || "inbound";
      const wrapup = row.wrapupId
        ? {
            isAutoVoided: row.isAutoVoided,
            noteAutoPosted: row.noteAutoPosted,
            completionAction: row.completionAction,
            outcome: row.wrapupOutcome,
            wrapupStatus: row.wrapupStatus,
            agencyzoomTicketId: row.agencyzoomTicketId,
            agencyzoomNoteId: row.wrapupNoteId,
            agencyzoomLeadId: row.agencyzoomLeadId,
          }
        : null;
      const triageAction = computeAction(wrapup);

      // Determine customer phone
      const isExtension = (num: string | null) => {
        if (!num) return false;
        return num.replace(/\D/g, "").length <= 4;
      };
      const isExternalNumber = (num: string | null) => {
        if (!num) return false;
        return num.replace(/\D/g, "").length >= 10;
      };

      let customerPhoneResolved: string | null;
      if (isExternalNumber(row.fromNumber) && isExtension(row.toNumber)) {
        customerPhoneResolved = row.fromNumber;
      } else if (isExternalNumber(row.toNumber) && isExtension(row.fromNumber)) {
        customerPhoneResolved = row.toNumber;
      } else {
        customerPhoneResolved = dir === "inbound" ? row.fromNumber : row.toNumber;
      }

      const trestleName = (row.wrapupTrestleData as { person?: { name?: string } } | null)?.person?.name;
      const customerName =
        row.customerFirstName && row.customerLastName
          ? `${row.customerFirstName} ${row.customerLastName}`
          : row.customerFirstName
            ? row.customerFirstName
            : row.wrapupCustomerName || trestleName || "Unknown";

      return {
        id: row.id,
        externalCallId: row.externalCallId || null,
        direction: dir,
        status: row.status || "completed",
        customerName,
        customerPhone: customerPhoneResolved || row.wrapupCustomerPhone || null,
        fromNumber: row.fromNumber || null,
        toNumber: row.toNumber || null,
        customerId: row.customerId || null,
        agentName:
          row.agentFirstName && row.agentLastName
            ? `${row.agentFirstName} ${row.agentLastName}`
            : "Unassigned",
        agentId: row.agentId || "",
        startedAt: row.startedAt?.toISOString() || new Date().toISOString(),
        endedAt: row.endedAt?.toISOString() || null,
        durationSeconds: row.durationSeconds || 0,
        summary: row.wrapupSummary || row.aiSummary || null,
        disposition: row.disposition,
        action: triageAction,
        matchStatus: row.matchStatus || null,
        // Media fields
        hasRecording: !!row.recordingUrl,
        hasTranscript: !!(row.transcription && row.transcription.length > 0),
        transcript: row.transcription || null,
        aiSentiment: row.aiSentiment != null ? Number(row.aiSentiment) : null,
        qualityScore: row.qualityScore != null ? Number(row.qualityScore) : null,
        predictedReason: row.predictedReason || null,
        // Detail fields
        hasWrapup: !!row.wrapupId,
        isAutoVoided: row.isAutoVoided || false,
        autoVoidReason: row.autoVoidReason || null,
        noteAutoPosted: row.noteAutoPosted || false,
        noteAutoPostedAt: row.noteAutoPostedAt?.toISOString() || null,
        completionAction: row.completionAction || null,
        agencyzoomNoteId: row.wrapupNoteId || row.agencyzoomNoteId || null,
        agencyzoomTicketId: row.agencyzoomTicketId || null,
        agencyzoomLeadId: row.agencyzoomLeadId || null,
        deleteReason: row.deleteReason || null,
        deleteNotes: row.deleteNotes || null,
        requestType: row.requestType || null,
        ticketType: row.ticketType || null,
        leadType: row.leadType || null,
        // Dedup tracking (set below)
        duplicateCount: 1,
      };
    });

    // =========================================================================
    // DEDUPLICATION
    // Group by normalized customer phone, then cluster records within 2 minutes.
    // This handles the same physical call arriving with different externalCallIds
    // from 3CX (numeric), VM Bridge (CA-prefix), and transcript worker (null),
    // as well as different extensions from call transfers.
    // =========================================================================
    const allEntries: typeof rawEntries = [];
    let duplicatesRemoved = 0;

    // Partition entries by normalized customer phone
    const phoneGroups = new Map<string, typeof rawEntries>();
    for (const entry of rawEntries) {
      const phone = normalizePhone(entry.customerPhone);
      if (!phone) {
        // No phone — can't dedup, keep as-is
        allEntries.push(entry);
        continue;
      }
      const existing = phoneGroups.get(phone);
      if (existing) existing.push(entry);
      else phoneGroups.set(phone, [entry]);
    }

    // Within each phone group, cluster entries within DEDUP_GAP_MS of each other
    for (const [, phoneGroup] of phoneGroups) {
      // Sort by time ascending
      phoneGroup.sort(
        (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      );

      const clusters: (typeof rawEntries)[] = [];
      let cluster = [phoneGroup[0]];

      for (let i = 1; i < phoneGroup.length; i++) {
        const prevTime = new Date(cluster[cluster.length - 1].startedAt).getTime();
        const currTime = new Date(phoneGroup[i].startedAt).getTime();

        if (currTime - prevTime <= DEDUP_GAP_MS) {
          cluster.push(phoneGroup[i]);
        } else {
          clusters.push(cluster);
          cluster = [phoneGroup[i]];
        }
      }
      clusters.push(cluster);

      // Pick the best record from each cluster
      for (const group of clusters) {
        if (group.length === 1) {
          allEntries.push(group[0]);
          continue;
        }

        let best = group[0];
        let bestScore = scoreRow(best);

        for (let i = 1; i < group.length; i++) {
          const s = scoreRow(group[i]);
          if (s > bestScore) {
            best = group[i];
            bestScore = s;
          }
        }

        // Merge data from all records in the cluster into the best one
        best.duplicateCount = group.length;

        // Merge transcripts: combine unique transcripts from all records
        const transcripts: string[] = [];
        for (const entry of group) {
          if (entry.transcript && !transcripts.includes(entry.transcript)) {
            transcripts.push(entry.transcript);
          }
        }
        if (transcripts.length > 0) {
          best.transcript = transcripts.length === 1
            ? transcripts[0]
            : transcripts.join('\n\n--- Merged Transcript ---\n\n');
          best.hasTranscript = true;
        }

        // Merge summaries: pick the longest/best summary available
        if (!best.summary) {
          for (const entry of group) {
            if (entry.summary && (!best.summary || entry.summary.length > best.summary.length)) {
              best.summary = entry.summary;
            }
          }
        }

        // Merge recording: if best has no recording but another does, take it
        if (!best.hasRecording) {
          for (const entry of group) {
            if (entry.hasRecording) {
              best.hasRecording = true;
              break;
            }
          }
        }

        // Use longest duration from the cluster
        for (const entry of group) {
          if (entry.durationSeconds > best.durationSeconds) {
            best.durationSeconds = entry.durationSeconds;
          }
        }

        allEntries.push(best);
        duplicatesRemoved += group.length - 1;
      }
    }

    // Sort by startedAt desc (groups may have shuffled order)
    allEntries.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    // Filter by action if specified
    const filtered = action && action !== "all"
      ? allEntries.filter((e) => e.action === action)
      : allEntries;

    // Compute stats from ALL entries (before pagination)
    const stats = {
      total: allEntries.length,
      autoPosted: allEntries.filter((e) => e.action === "auto_posted").length,
      ticketCreated: allEntries.filter((e) => e.action === "ticket_created").length,
      leadCreated: allEntries.filter((e) => e.action === "lead_created").length,
      autoVoided: allEntries.filter((e) => e.action === "auto_voided").length,
      pending: allEntries.filter((e) => e.action === "pending").length,
      deleted: allEntries.filter((e) => e.action === "deleted").length,
      skipped: allEntries.filter((e) => e.action === "skipped").length,
      noWrapup: allEntries.filter((e) => e.action === "no_wrapup").length,
      duplicatesRemoved,
    };

    // Paginate
    const paginated = filtered.slice(offset, offset + limit);

    // Get agents for filter dropdown
    const agents = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    const agentOptions = [
      { id: "all", name: "All Agents" },
      ...agents.map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` })),
    ];

    return NextResponse.json({
      success: true,
      entries: paginated,
      stats,
      agents: agentOptions,
      total: filtered.length,
    });
  } catch (error: any) {
    console.error("[Triage Log API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch triage log", details: error.message },
      { status: 500 }
    );
  }
}
