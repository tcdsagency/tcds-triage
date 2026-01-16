// API Route: /api/settings/call-monitor
// Call Accountability Monitor - Detect and fix call system discrepancies

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, triageItems, messages, liveTranscriptSegments, users } from "@/db/schema";
import { eq, sql, and, isNull, isNotNull, lt, gt, desc, inArray } from "drizzle-orm";

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

// GET - Fetch call discrepancy data
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("range") || "24h"; // 24h, 7d, 30d

    // Calculate time interval
    let interval: string;
    switch (timeRange) {
      case "7d":
        interval = "7 days";
        break;
      case "30d":
        interval = "30 days";
        break;
      default:
        interval = "24 hours";
    }

    // 1. Get total calls count
    const totalCallsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM calls
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND created_at > NOW() - INTERVAL '${sql.raw(interval)}'
    `);
    const totalCalls = Number((totalCallsResult[0] as any)?.count || 0);

    // 2. Calls with transcription
    const transcribedResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM calls
      WHERE tenant_id = ${DEFAULT_TENANT_ID}
        AND created_at > NOW() - INTERVAL '${sql.raw(interval)}'
        AND transcription IS NOT NULL
        AND LENGTH(transcription) > 10
    `);
    const transcribedCalls = Number((transcribedResult[0] as any)?.count || 0);

    // 3. Calls with vmSessionId but NO transcript segments (missing transcripts)
    const missingTranscriptsResult = await db.execute(sql`
      SELECT c.id, c.direction, c.from_number, c.to_number, c.status,
             c.vm_session_id, c.extension, c.created_at, c.agent_id,
             u.first_name as agent_first_name, u.last_name as agent_last_name,
             (SELECT COUNT(*) FROM live_transcript_segments WHERE call_id = c.id) as segment_count
      FROM calls c
      LEFT JOIN users u ON c.agent_id = u.id
      WHERE c.tenant_id = ${DEFAULT_TENANT_ID}
        AND c.created_at > NOW() - INTERVAL '${sql.raw(interval)}'
        AND c.vm_session_id IS NOT NULL
        AND c.transcription IS NULL
      ORDER BY c.created_at DESC
      LIMIT 50
    `);

    // 4. Calls with transcript segments but no final transcription field
    const unfinishedTranscriptsResult = await db.execute(sql`
      SELECT c.id, c.direction, c.from_number, c.to_number, c.status,
             c.vm_session_id, c.extension, c.created_at, c.agent_id,
             u.first_name as agent_first_name, u.last_name as agent_last_name,
             (SELECT COUNT(*) FROM live_transcript_segments WHERE call_id = c.id) as segment_count
      FROM calls c
      LEFT JOIN users u ON c.agent_id = u.id
      WHERE c.tenant_id = ${DEFAULT_TENANT_ID}
        AND c.created_at > NOW() - INTERVAL '${sql.raw(interval)}'
        AND c.transcription IS NULL
        AND EXISTS (SELECT 1 FROM live_transcript_segments WHERE call_id = c.id)
      ORDER BY c.created_at DESC
      LIMIT 50
    `);

    // 5. After-hours triage items with message_id but no call_id (orphaned)
    const orphanedTriageResult = await db.execute(sql`
      SELECT t.id, t.type, t.status, t.title, t.description, t.created_at,
             t.message_id, m.from_number as message_phone, m.body as message_body
      FROM triage_items t
      LEFT JOIN messages m ON t.message_id = m.id
      WHERE t.tenant_id = ${DEFAULT_TENANT_ID}
        AND t.type = 'after_hours'
        AND t.call_id IS NULL
        AND t.message_id IS NOT NULL
        AND t.created_at > NOW() - INTERVAL '${sql.raw(interval)}'
      ORDER BY t.created_at DESC
      LIMIT 50
    `);

    // 6. Stale ringing calls (webhook failures - still ringing after 2 hours)
    const staleRingingResult = await db.execute(sql`
      SELECT c.id, c.direction, c.from_number, c.to_number, c.status,
             c.extension, c.created_at, c.agent_id,
             u.first_name as agent_first_name, u.last_name as agent_last_name,
             EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 60 as minutes_old
      FROM calls c
      LEFT JOIN users u ON c.agent_id = u.id
      WHERE c.tenant_id = ${DEFAULT_TENANT_ID}
        AND c.status = 'ringing'
        AND c.created_at < NOW() - INTERVAL '2 hours'
      ORDER BY c.created_at ASC
      LIMIT 50
    `);

    // 7. Stale in_progress calls (no endedAt for > 4 hours)
    const staleInProgressResult = await db.execute(sql`
      SELECT c.id, c.direction, c.from_number, c.to_number, c.status,
             c.extension, c.created_at, c.agent_id,
             u.first_name as agent_first_name, u.last_name as agent_last_name,
             EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 60 as minutes_old
      FROM calls c
      LEFT JOIN users u ON c.agent_id = u.id
      WHERE c.tenant_id = ${DEFAULT_TENANT_ID}
        AND c.status = 'in_progress'
        AND c.ended_at IS NULL
        AND c.created_at < NOW() - INTERVAL '4 hours'
      ORDER BY c.created_at ASC
      LIMIT 50
    `);

    // Format results
    const missingTranscripts = (missingTranscriptsResult as any[]).map(c => ({
      id: c.id,
      direction: c.direction,
      fromNumber: c.from_number,
      toNumber: c.to_number,
      status: c.status,
      vmSessionId: c.vm_session_id,
      extension: c.extension,
      createdAt: c.created_at,
      agentName: c.agent_first_name ? `${c.agent_first_name} ${c.agent_last_name}` : null,
      segmentCount: Number(c.segment_count),
    }));

    const unfinishedTranscripts = (unfinishedTranscriptsResult as any[]).map(c => ({
      id: c.id,
      direction: c.direction,
      fromNumber: c.from_number,
      toNumber: c.to_number,
      status: c.status,
      vmSessionId: c.vm_session_id,
      extension: c.extension,
      createdAt: c.created_at,
      agentName: c.agent_first_name ? `${c.agent_first_name} ${c.agent_last_name}` : null,
      segmentCount: Number(c.segment_count),
    }));

    const orphanedTriageItems = (orphanedTriageResult as any[]).map(t => ({
      id: t.id,
      type: t.type,
      status: t.status,
      title: t.title,
      description: t.description,
      createdAt: t.created_at,
      messageId: t.message_id,
      messagePhone: t.message_phone,
      messageBody: t.message_body?.slice(0, 200),
    }));

    const staleCalls = [
      ...(staleRingingResult as any[]).map(c => ({
        id: c.id,
        direction: c.direction,
        fromNumber: c.from_number,
        toNumber: c.to_number,
        status: c.status,
        extension: c.extension,
        createdAt: c.created_at,
        agentName: c.agent_first_name ? `${c.agent_first_name} ${c.agent_last_name}` : null,
        minutesOld: Math.round(Number(c.minutes_old)),
        type: "stale_ringing",
      })),
      ...(staleInProgressResult as any[]).map(c => ({
        id: c.id,
        direction: c.direction,
        fromNumber: c.from_number,
        toNumber: c.to_number,
        status: c.status,
        extension: c.extension,
        createdAt: c.created_at,
        agentName: c.agent_first_name ? `${c.agent_first_name} ${c.agent_last_name}` : null,
        minutesOld: Math.round(Number(c.minutes_old)),
        type: "stale_in_progress",
      })),
    ];

    return NextResponse.json({
      success: true,
      timeRange,
      stats: {
        totalCalls,
        transcribedCalls,
        missingTranscriptCount: missingTranscripts.filter(c => c.segmentCount === 0).length,
        unfinishedTranscriptCount: unfinishedTranscripts.length,
        orphanedTriageCount: orphanedTriageItems.length,
        staleCallCount: staleCalls.length,
      },
      discrepancies: {
        missingTranscripts,
        unfinishedTranscripts,
        orphanedTriageItems,
        staleCalls,
      },
    });
  } catch (error) {
    console.error("[CallMonitor] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch call monitor data" },
      { status: 500 }
    );
  }
}

// POST - Fix discrepancies
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, ids } = body;

    switch (action) {
      // Mark stale ringing calls as missed
      case "mark_stale_missed": {
        if (ids && Array.isArray(ids)) {
          await db
            .update(calls)
            .set({
              status: "missed",
              disposition: "abandoned",
              endedAt: new Date(),
            })
            .where(inArray(calls.id, ids));

          return NextResponse.json({
            success: true,
            message: `Marked ${ids.length} calls as missed`,
          });
        }

        if (id) {
          await db
            .update(calls)
            .set({
              status: "missed",
              disposition: "abandoned",
              endedAt: new Date(),
            })
            .where(eq(calls.id, id));

          return NextResponse.json({
            success: true,
            message: "Call marked as missed",
          });
        }
        break;
      }

      // Mark stale in_progress calls as completed
      case "mark_stale_completed": {
        if (ids && Array.isArray(ids)) {
          await db
            .update(calls)
            .set({
              status: "completed",
              endedAt: new Date(),
            })
            .where(inArray(calls.id, ids));

          return NextResponse.json({
            success: true,
            message: `Marked ${ids.length} calls as completed`,
          });
        }

        if (id) {
          await db
            .update(calls)
            .set({
              status: "completed",
              endedAt: new Date(),
            })
            .where(eq(calls.id, id));

          return NextResponse.json({
            success: true,
            message: "Call marked as completed",
          });
        }
        break;
      }

      // Rebuild transcript from segments
      case "rebuild_transcript": {
        if (!id) {
          return NextResponse.json(
            { success: false, error: "Call ID required" },
            { status: 400 }
          );
        }

        // Get all segments for this call
        const segments = await db
          .select()
          .from(liveTranscriptSegments)
          .where(eq(liveTranscriptSegments.callId, id))
          .orderBy(liveTranscriptSegments.sequenceNumber);

        if (segments.length === 0) {
          return NextResponse.json(
            { success: false, error: "No transcript segments found" },
            { status: 404 }
          );
        }

        // Combine segments into transcript
        const transcript = segments
          .map(s => `${s.speaker}: ${s.text}`)
          .join("\n");

        // Update call with rebuilt transcript
        await db
          .update(calls)
          .set({
            transcription: transcript,
            transcriptionStatus: "completed",
          })
          .where(eq(calls.id, id));

        return NextResponse.json({
          success: true,
          message: `Rebuilt transcript from ${segments.length} segments`,
          segmentCount: segments.length,
        });
      }

      // Rebuild all unfinished transcripts
      case "rebuild_all_transcripts": {
        if (!ids || !Array.isArray(ids)) {
          return NextResponse.json(
            { success: false, error: "Call IDs required" },
            { status: 400 }
          );
        }

        let rebuilt = 0;
        for (const callId of ids) {
          const segments = await db
            .select()
            .from(liveTranscriptSegments)
            .where(eq(liveTranscriptSegments.callId, callId))
            .orderBy(liveTranscriptSegments.sequenceNumber);

          if (segments.length > 0) {
            const transcript = segments
              .map(s => `${s.speaker}: ${s.text}`)
              .join("\n");

            await db
              .update(calls)
              .set({
                transcription: transcript,
                transcriptionStatus: "completed",
              })
              .where(eq(calls.id, callId));

            rebuilt++;
          }
        }

        return NextResponse.json({
          success: true,
          message: `Rebuilt ${rebuilt} transcripts`,
        });
      }

      // Link orphaned triage item to call
      case "link_triage_to_call": {
        const { triageId, callId } = body;

        if (!triageId || !callId) {
          return NextResponse.json(
            { success: false, error: "Triage ID and Call ID required" },
            { status: 400 }
          );
        }

        await db
          .update(triageItems)
          .set({ callId })
          .where(eq(triageItems.id, triageId));

        return NextResponse.json({
          success: true,
          message: "Triage item linked to call",
        });
      }

      // Clear all active/ringing calls (reset to start fresh)
      case "clear_all_active_calls": {
        // Mark all ringing calls as missed
        const ringingResult = await db.execute(sql`
          UPDATE calls
          SET status = 'missed',
              disposition = 'abandoned',
              ended_at = NOW()
          WHERE tenant_id = ${DEFAULT_TENANT_ID}
            AND status = 'ringing'
          RETURNING id
        `);

        // Mark all in_progress calls as completed
        const inProgressResult = await db.execute(sql`
          UPDATE calls
          SET status = 'completed',
              ended_at = NOW()
          WHERE tenant_id = ${DEFAULT_TENANT_ID}
            AND status = 'in_progress'
          RETURNING id
        `);

        const ringingCleared = (ringingResult as any[]).length;
        const inProgressCleared = (inProgressResult as any[]).length;
        const total = ringingCleared + inProgressCleared;

        return NextResponse.json({
          success: true,
          message: `Cleared ${total} calls (${ringingCleared} ringing → missed, ${inProgressCleared} in_progress → completed)`,
          ringingCleared,
          inProgressCleared,
        });
      }

      // Auto-link orphaned triage items by matching phone/time
      case "auto_link_triage": {
        if (!id) {
          return NextResponse.json(
            { success: false, error: "Triage ID required" },
            { status: 400 }
          );
        }

        // Get the triage item and its message
        const triageResult = await db.execute(sql`
          SELECT t.id, t.message_id, t.created_at,
                 m.from_number
          FROM triage_items t
          LEFT JOIN messages m ON t.message_id = m.id
          WHERE t.id = ${id}
        `);

        const triage = triageResult[0] as any;
        if (!triage || !triage.from_number) {
          return NextResponse.json(
            { success: false, error: "Triage item or message not found" },
            { status: 404 }
          );
        }

        // Clean phone number for matching (last 10 digits)
        const cleanPhone = triage.from_number.replace(/\D/g, "").slice(-10);

        // Find matching call within 10 minute window
        const matchResult = await db.execute(sql`
          SELECT id, from_number, to_number, created_at
          FROM calls
          WHERE tenant_id = ${DEFAULT_TENANT_ID}
            AND (
              REPLACE(REPLACE(REPLACE(from_number, '+', ''), '-', ''), ' ', '') LIKE ${"%" + cleanPhone}
              OR REPLACE(REPLACE(REPLACE(to_number, '+', ''), '-', ''), ' ', '') LIKE ${"%" + cleanPhone}
            )
            AND created_at BETWEEN ${triage.created_at}::timestamp - INTERVAL '10 minutes'
                               AND ${triage.created_at}::timestamp + INTERVAL '10 minutes'
          ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - ${triage.created_at}::timestamp)))
          LIMIT 1
        `);

        if (matchResult.length === 0) {
          return NextResponse.json({
            success: false,
            error: "No matching call found",
          });
        }

        const matchedCall = matchResult[0] as any;

        // Link the triage item
        await db
          .update(triageItems)
          .set({ callId: matchedCall.id })
          .where(eq(triageItems.id, id));

        return NextResponse.json({
          success: true,
          message: "Triage item linked to call",
          callId: matchedCall.id,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }

    return NextResponse.json(
      { success: false, error: "Action not completed" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[CallMonitor] Fix error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fix discrepancy" },
      { status: 500 }
    );
  }
}
