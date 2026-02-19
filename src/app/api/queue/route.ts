// =============================================================================
// Unified Queue API
// =============================================================================
// Replaces: /api/triage-log, /api/pending-review/*, /api/triage/*
// Single endpoint for all queue operations: pending, completed, all
// Reads from wrapup_drafts JOIN calls JOIN customers JOIN users
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, calls, customers, users, serviceTickets } from "@/db/schema";
import { eq, and, sql, or, ilike, gte, lte, desc, asc } from "drizzle-orm";

const TENANT_ID = process.env.DEFAULT_TENANT_ID!;

// =============================================================================
// Types
// =============================================================================

interface QueueItem {
  id: string;
  callId: string;
  direction: string;
  status: string;
  source: string | null;
  // Contact
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerId: string | null;
  // Call info
  agentName: string | null;
  agentExtension: string | null;
  durationSeconds: number | null;
  startedAt: string | null;
  // Content
  summary: string | null;
  requestType: string | null;
  insuranceType: string | null;
  policyNumbers: string[] | null;
  sentiment: string | null;
  // Outcome
  completionAction: string | null;
  outcome: string | null;
  isAutoVoided: boolean;
  autoVoidReason: string | null;
  // AgencyZoom
  agencyzoomTicketId: string | null;
  agencyzoomNoteId: string | null;
  // 3CX
  threecxRecordingId: number | null;
  recordingUrl: string | null;
  hasTranscript: boolean;
  // Matching
  matchStatus: string | null;
  // Timestamps
  createdAt: string;
  completedAt: string | null;
  // Linked ticket info
  linkedTicket: {
    azTicketId: number;
    subject: string;
    status: string;
    stageName: string | null;
  } | null;
}

// =============================================================================
// GET /api/queue
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const view = params.get('view') || 'pending';         // pending | completed | all
    const direction = params.get('direction');              // inbound | outbound
    const agent = params.get('agent');                      // extension filter
    const search = params.get('search');                    // name, phone, summary
    const dateFrom = params.get('dateFrom');                // ISO date
    const dateTo = params.get('dateTo');                    // ISO date
    const page = parseInt(params.get('page') || '1', 10);
    const limit = Math.min(parseInt(params.get('limit') || '50', 10), 200);
    const sort = params.get('sort') || 'newest';           // newest | oldest | priority

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions = [eq(wrapupDrafts.tenantId, TENANT_ID)];

    // View filter
    if (view === 'pending') {
      conditions.push(
        or(
          eq(wrapupDrafts.status, 'pending_review'),
          eq(wrapupDrafts.status, 'pending_ai_processing'),
        )!,
      );
    } else if (view === 'completed') {
      conditions.push(
        or(
          eq(wrapupDrafts.status, 'completed'),
          eq(wrapupDrafts.status, 'posted'),
        )!,
      );
    }
    // 'all' = no status filter

    // Direction filter
    if (direction === 'inbound') {
      conditions.push(eq(wrapupDrafts.direction, 'Inbound'));
    } else if (direction === 'outbound') {
      conditions.push(eq(wrapupDrafts.direction, 'Outbound'));
    }

    // Agent filter
    if (agent) {
      conditions.push(eq(wrapupDrafts.agentExtension, agent));
    }

    // Search filter
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(wrapupDrafts.customerName, searchPattern),
          ilike(wrapupDrafts.customerPhone, searchPattern),
          ilike(wrapupDrafts.summary, searchPattern),
          ilike(wrapupDrafts.aiCleanedSummary, searchPattern),
        )!,
      );
    }

    // Date range filter
    if (dateFrom) {
      conditions.push(gte(wrapupDrafts.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(wrapupDrafts.createdAt, new Date(dateTo)));
    }

    const whereClause = and(...conditions);

    // Sort
    const orderBy = sort === 'oldest'
      ? asc(wrapupDrafts.createdAt)
      : sort === 'priority'
        ? desc(wrapupDrafts.priorityScore)
        : desc(wrapupDrafts.createdAt);

    // Get total count
    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wrapupDrafts)
      .where(whereClause);

    // Get items with joins
    const rows = await db
      .select({
        // Wrapup fields
        id: wrapupDrafts.id,
        callId: wrapupDrafts.callId,
        direction: wrapupDrafts.direction,
        status: wrapupDrafts.status,
        source: wrapupDrafts.source,
        customerName: wrapupDrafts.customerName,
        customerPhone: wrapupDrafts.customerPhone,
        customerEmail: wrapupDrafts.customerEmail,
        agentName: wrapupDrafts.agentName,
        agentExtension: wrapupDrafts.agentExtension,
        summary: wrapupDrafts.aiCleanedSummary,
        requestType: wrapupDrafts.requestType,
        insuranceType: wrapupDrafts.insuranceType,
        policyNumbers: wrapupDrafts.policyNumbers,
        completionAction: wrapupDrafts.completionAction,
        outcome: wrapupDrafts.outcome,
        isAutoVoided: wrapupDrafts.isAutoVoided,
        autoVoidReason: wrapupDrafts.autoVoidReason,
        agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
        agencyzoomNoteId: wrapupDrafts.agencyzoomNoteId,
        threecxRecordingId: wrapupDrafts.threecxRecordingId,
        matchStatus: wrapupDrafts.matchStatus,
        createdAt: wrapupDrafts.createdAt,
        completedAt: wrapupDrafts.completedAt,
        priorityScore: wrapupDrafts.priorityScore,
        // Call fields
        callDuration: calls.durationSeconds,
        callStartedAt: calls.startedAt,
        callRecordingUrl: calls.recordingUrl,
        callTranscription: calls.transcription,
        callSentiment: calls.aiSentiment,
        // Customer fields
        customerId: customers.id,
      })
      .from(wrapupDrafts)
      .leftJoin(calls, eq(wrapupDrafts.callId, calls.id))
      .leftJoin(customers, eq(calls.customerId, customers.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Batch fetch linked tickets for items that have them
    const ticketIds = rows
      .filter(r => r.agencyzoomTicketId)
      .map(r => r.agencyzoomTicketId!);

    const linkedTickets = ticketIds.length > 0
      ? await db
          .select({
            wrapupDraftId: serviceTickets.wrapupDraftId,
            azTicketId: serviceTickets.azTicketId,
            subject: serviceTickets.subject,
            status: serviceTickets.status,
            stageName: serviceTickets.stageName,
          })
          .from(serviceTickets)
          .where(
            sql`${serviceTickets.wrapupDraftId} IN (${sql.join(
              rows.filter(r => r.agencyzoomTicketId).map(r => sql`${r.id}`),
              sql`, `,
            )})`,
          )
      : [];

    const ticketMap = new Map(linkedTickets.map(t => [t.wrapupDraftId, t]));

    // Map to response
    const items: QueueItem[] = rows.map(row => {
      const ticket = ticketMap.get(row.id);
      const sentiment = row.callSentiment as { overall?: string } | null;

      return {
        id: row.id,
        callId: row.callId,
        direction: row.direction,
        status: row.status,
        source: row.source,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        customerEmail: row.customerEmail,
        customerId: row.customerId ?? null,
        agentName: row.agentName,
        agentExtension: row.agentExtension,
        durationSeconds: row.callDuration,
        startedAt: row.callStartedAt?.toISOString() ?? null,
        summary: row.summary,
        requestType: row.requestType,
        insuranceType: row.insuranceType,
        policyNumbers: row.policyNumbers,
        sentiment: sentiment?.overall ?? null,
        completionAction: row.completionAction,
        outcome: row.outcome,
        isAutoVoided: row.isAutoVoided ?? false,
        autoVoidReason: row.autoVoidReason,
        agencyzoomTicketId: row.agencyzoomTicketId,
        agencyzoomNoteId: row.agencyzoomNoteId,
        threecxRecordingId: row.threecxRecordingId,
        recordingUrl: row.callRecordingUrl,
        hasTranscript: !!(row.callTranscription && row.callTranscription.length > 20),
        matchStatus: row.matchStatus,
        createdAt: row.createdAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        linkedTicket: ticket ? {
          azTicketId: ticket.azTicketId,
          subject: ticket.subject,
          status: ticket.status,
          stageName: ticket.stageName,
        } : null,
      };
    });

    // Stats (for pending view)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const [stats] = await db
      .select({
        pending: sql<number>`count(*) FILTER (WHERE ${wrapupDrafts.status} IN ('pending_review', 'pending_ai_processing'))::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${wrapupDrafts.status} IN ('completed', 'posted') AND ${wrapupDrafts.createdAt} >= ${todayISO})::int`,
        autoVoided: sql<number>`count(*) FILTER (WHERE ${wrapupDrafts.isAutoVoided} = true AND ${wrapupDrafts.createdAt} >= ${todayISO})::int`,
        ticketsCreated: sql<number>`count(*) FILTER (WHERE ${wrapupDrafts.agencyzoomTicketId} IS NOT NULL AND ${wrapupDrafts.createdAt} >= ${todayISO})::int`,
      })
      .from(wrapupDrafts)
      .where(eq(wrapupDrafts.tenantId, TENANT_ID));

    return NextResponse.json({
      items,
      total,
      page,
      hasMore: offset + limit < total,
      stats: {
        pending: stats.pending,
        completed: stats.completed,
        autoVoided: stats.autoVoided,
        ticketsCreated: stats.ticketsCreated,
      },
    });
  } catch (error) {
    console.error('[queue] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
