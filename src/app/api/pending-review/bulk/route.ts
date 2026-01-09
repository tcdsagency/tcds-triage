// API Route: /api/pending-review/bulk
// Bulk actions for pending review items

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts, messages, customers } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// =============================================================================
// TYPES
// =============================================================================

interface BulkRequest {
  items: Array<{
    id: string;
    type: 'wrapup' | 'message' | 'lead';
    customerId?: string;
  }>;
  action: 'note' | 'ticket' | 'acknowledge' | 'skip' | 'delete';
}

// =============================================================================
// POST - Bulk action on items
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: BulkRequest = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const results = {
      success: true,
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Group items by type
    const wrapupIds = body.items.filter(i => i.type === 'wrapup').map(i => i.id);
    const messageIds = body.items.filter(i => i.type === 'message').map(i => i.id);
    const leadIds = body.items.filter(i => i.type === 'lead').map(i => i.id);

    const azClient = body.action !== 'skip' && body.action !== 'acknowledge' && body.action !== 'delete'
      ? await getAgencyZoomClient()
      : null;

    // =======================================================================
    // HANDLE SKIP ACTION
    // =======================================================================
    if (body.action === 'skip') {
      // Mark wrapups as skipped
      if (wrapupIds.length > 0) {
        await db
          .update(wrapupDrafts)
          .set({
            status: "completed",
            reviewerDecision: "skipped",
            outcome: "skipped",
            completedAt: new Date(),
          })
          .where(inArray(wrapupDrafts.id, wrapupIds));
        results.processed += wrapupIds.length;
      }

      // Mark messages as acknowledged
      if (messageIds.length > 0) {
        await db
          .update(messages)
          .set({ isAcknowledged: true })
          .where(inArray(messages.id, messageIds));
        results.processed += messageIds.length;
      }

      // Leads - no action needed for skip
      results.processed += leadIds.length;

      return NextResponse.json(results);
    }

    // =======================================================================
    // HANDLE DELETE ACTION
    // =======================================================================
    if (body.action === 'delete') {
      // Delete wrapups
      if (wrapupIds.length > 0) {
        await db
          .delete(wrapupDrafts)
          .where(inArray(wrapupDrafts.id, wrapupIds));
        results.processed += wrapupIds.length;
      }

      // Delete messages
      if (messageIds.length > 0) {
        await db
          .delete(messages)
          .where(inArray(messages.id, messageIds));
        results.processed += messageIds.length;
      }

      // Don't delete leads - they're important customer data
      if (leadIds.length > 0) {
        results.errors.push("Leads cannot be bulk deleted");
        results.failed += leadIds.length;
      }

      return NextResponse.json(results);
    }

    // =======================================================================
    // HANDLE ACKNOWLEDGE ACTION
    // =======================================================================
    if (body.action === 'acknowledge') {
      // Mark messages as acknowledged
      if (messageIds.length > 0) {
        await db
          .update(messages)
          .set({ isAcknowledged: true })
          .where(inArray(messages.id, messageIds));
        results.processed += messageIds.length;
      }

      // Wrapups and leads don't have acknowledge
      if (wrapupIds.length > 0 || leadIds.length > 0) {
        results.errors.push("Acknowledge only applies to messages");
        results.failed += wrapupIds.length + leadIds.length;
      }

      return NextResponse.json(results);
    }

    // =======================================================================
    // HANDLE NOTE/TICKET ACTIONS
    // =======================================================================
    if ((body.action === 'note' || body.action === 'ticket') && azClient) {
      // Process each item individually for note/ticket actions
      for (const item of body.items) {
        try {
          if (item.type === 'wrapup') {
            const [wrapup] = await db
              .select()
              .from(wrapupDrafts)
              .where(eq(wrapupDrafts.id, item.id))
              .limit(1);

            if (!wrapup) {
              results.failed++;
              results.errors.push(`Wrapup ${item.id} not found`);
              continue;
            }

            const customerId = item.customerId
              ? parseInt(item.customerId)
              : (wrapup.aiExtraction as { agencyZoomCustomerId?: string })?.agencyZoomCustomerId
                ? parseInt((wrapup.aiExtraction as { agencyZoomCustomerId: string }).agencyZoomCustomerId)
                : null;

            if (!customerId) {
              results.failed++;
              results.errors.push(`Wrapup ${item.id}: No customer ID`);
              continue;
            }

            const noteText = `Call Note:\n${wrapup.aiCleanedSummary || wrapup.summary || ''}\n\nDate: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })}`;

            if (body.action === 'note') {
              const noteResult = await azClient.addNote(customerId, noteText);
              if (noteResult.success) {
                await db
                  .update(wrapupDrafts)
                  .set({
                    status: "completed",
                    reviewerDecision: "approved",
                    outcome: "note_posted",
                    agencyzoomNoteId: noteResult.id?.toString(),
                    completedAt: new Date(),
                  })
                  .where(eq(wrapupDrafts.id, item.id));
                results.processed++;
              } else {
                results.failed++;
                results.errors.push(`Wrapup ${item.id}: Note post failed`);
              }
            } else if (body.action === 'ticket') {
              // Post note first
              let noteId: number | undefined;
              const noteResult = await azClient.addNote(customerId, noteText);
              if (noteResult.success) {
                noteId = noteResult.id;
              }

              // Create ticket
              const ticketResult = await azClient.createServiceTicket({
                subject: `Follow-up: ${wrapup.requestType || 'Call'} - ${wrapup.customerName || 'Customer'}`,
                description: wrapup.aiCleanedSummary || wrapup.summary || '',
                customerId,
                pipelineId: 1,
                stageId: 1,
                priorityId: 2,
              });

              if (ticketResult.success) {
                await db
                  .update(wrapupDrafts)
                  .set({
                    status: "completed",
                    reviewerDecision: "approved",
                    outcome: "ticket_created",
                    agencyzoomNoteId: noteId?.toString(),
                    agencyzoomTicketId: ticketResult.serviceTicketId?.toString(),
                    completedAt: new Date(),
                  })
                  .where(eq(wrapupDrafts.id, item.id));
                results.processed++;
              } else {
                results.failed++;
                results.errors.push(`Wrapup ${item.id}: Ticket creation failed`);
              }
            }
          } else if (item.type === 'message') {
            const [message] = await db
              .select()
              .from(messages)
              .where(eq(messages.id, item.id))
              .limit(1);

            if (!message) {
              results.failed++;
              results.errors.push(`Message ${item.id} not found`);
              continue;
            }

            const customerId = item.customerId
              ? parseInt(item.customerId)
              : message.contactId
                ? parseInt(message.contactId)
                : null;

            if (!customerId) {
              results.failed++;
              results.errors.push(`Message ${item.id}: No customer ID`);
              continue;
            }

            const noteText = `SMS Message:\n${message.body || ''}\n\nFrom: ${message.fromNumber}\nDate: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })}`;

            const noteResult = await azClient.addNote(customerId, noteText);
            if (noteResult.success) {
              await db
                .update(messages)
                .set({ isAcknowledged: true })
                .where(eq(messages.id, item.id));
              results.processed++;
            } else {
              results.failed++;
              results.errors.push(`Message ${item.id}: Note post failed`);
            }
          } else if (item.type === 'lead') {
            // Leads are already in the system
            results.processed++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Item ${item.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return NextResponse.json(results);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Bulk Action] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk action failed" },
      { status: 500 }
    );
  }
}
