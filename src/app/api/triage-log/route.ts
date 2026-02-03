// API Route: /api/triage-log
// Returns every call with its triage outcome (joined with wrapup_drafts)

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
} | null): TriageAction {
  if (!wrapup) return "no_wrapup";
  if (wrapup.isAutoVoided) return "auto_voided";
  if (wrapup.noteAutoPosted) return "auto_posted";
  if (wrapup.completionAction === "ticket") return "ticket_created";
  if (wrapup.completionAction === "lead") return "lead_created";
  if (wrapup.completionAction === "deleted") return "deleted";
  if (wrapup.completionAction === "skipped") return "skipped";
  if (wrapup.completionAction === "posted") return "auto_posted";
  // Wrapup exists but no completion action yet
  return "pending";
}

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
        direction: calls.directionFinal,
        directionLive: calls.directionLive,
        status: calls.status,
        fromNumber: calls.fromNumber,
        toNumber: calls.toNumber,
        customerId: calls.customerId,
        agentId: calls.agentId,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        aiSummary: calls.aiSummary,
        disposition: calls.disposition,
        agencyzoomNoteId: calls.agencyzoomNoteId,
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

    // Compute action for each row and filter
    const allEntries = rows.map((row) => {
      const dir = row.direction || row.directionLive || "inbound";
      const wrapup = row.wrapupId
        ? {
            isAutoVoided: row.isAutoVoided,
            noteAutoPosted: row.noteAutoPosted,
            completionAction: row.completionAction,
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

      let customerPhone: string | null;
      if (isExternalNumber(row.fromNumber) && isExtension(row.toNumber)) {
        customerPhone = row.fromNumber;
      } else if (isExternalNumber(row.toNumber) && isExtension(row.fromNumber)) {
        customerPhone = row.toNumber;
      } else {
        customerPhone = dir === "inbound" ? row.fromNumber : row.toNumber;
      }

      const customerName =
        row.customerFirstName && row.customerLastName
          ? `${row.customerFirstName} ${row.customerLastName}`
          : row.wrapupCustomerName || "Unknown";

      return {
        id: row.id,
        direction: dir,
        status: row.status || "completed",
        customerName,
        customerPhone: customerPhone || row.wrapupCustomerPhone || null,
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
      };
    });

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
