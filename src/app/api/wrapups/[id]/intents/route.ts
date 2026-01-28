/**
 * Call Intents API
 * ================
 * Manage intents for multi-intent calls.
 *
 * GET /api/wrapups/[id]/intents - Get all intents for a wrapup
 * PATCH /api/wrapups/[id]/intents - Update intent details
 * POST /api/wrapups/[id]/intents/batch-create - Create tickets for selected intents
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { callIntents, wrapupDrafts, serviceTickets, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';
import {
  SERVICE_PIPELINES,
  PIPELINE_STAGES,
  SERVICE_PRIORITIES,
  SERVICE_CATEGORIES,
  getDefaultDueDate,
} from '@/lib/api/agencyzoom-service-tickets';

// =============================================================================
// GET - Get all intents for a wrapup
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: wrapupId } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not configured' },
        { status: 500 }
      );
    }

    // Get the wrapup to verify it exists
    const [wrapup] = await db
      .select({
        id: wrapupDrafts.id,
        intentCount: wrapupDrafts.intentCount,
        multiIntentDetected: wrapupDrafts.multiIntentDetected,
      })
      .from(wrapupDrafts)
      .where(and(eq(wrapupDrafts.id, wrapupId), eq(wrapupDrafts.tenantId, tenantId)))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json(
        { success: false, error: 'Wrapup not found' },
        { status: 404 }
      );
    }

    // Get all intents for this wrapup
    const intents = await db
      .select()
      .from(callIntents)
      .where(eq(callIntents.wrapupDraftId, wrapupId))
      .orderBy(callIntents.intentNumber);

    return NextResponse.json({
      success: true,
      data: {
        wrapupId,
        intentCount: wrapup.intentCount,
        multiIntentDetected: wrapup.multiIntentDetected,
        intents,
      },
    });
  } catch (error) {
    console.error('[Intents API] Error getting intents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get intents' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update an intent
// =============================================================================

interface UpdateIntentRequest {
  intentId: string;
  summary?: string;
  requestType?: string;
  categoryId?: number | null;
  priorityId?: number | null;
  description?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: wrapupId } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not configured' },
        { status: 500 }
      );
    }

    const body: UpdateIntentRequest = await request.json();

    if (!body.intentId) {
      return NextResponse.json(
        { success: false, error: 'intentId is required' },
        { status: 400 }
      );
    }

    // Verify the intent exists and belongs to this wrapup
    const [existingIntent] = await db
      .select()
      .from(callIntents)
      .where(
        and(
          eq(callIntents.id, body.intentId),
          eq(callIntents.wrapupDraftId, wrapupId)
        )
      )
      .limit(1);

    if (!existingIntent) {
      return NextResponse.json(
        { success: false, error: 'Intent not found' },
        { status: 404 }
      );
    }

    // Can't update if ticket already created
    if (existingIntent.ticketCreated) {
      return NextResponse.json(
        { success: false, error: 'Cannot update intent - ticket already created' },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Partial<typeof callIntents.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.requestType !== undefined) updates.requestType = body.requestType;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.priorityId !== undefined) updates.priorityId = body.priorityId;
    if (body.description !== undefined) updates.description = body.description;

    // Update the intent
    const [updatedIntent] = await db
      .update(callIntents)
      .set(updates)
      .where(eq(callIntents.id, body.intentId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedIntent,
    });
  } catch (error) {
    console.error('[Intents API] Error updating intent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update intent' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Batch create tickets for selected intents
// =============================================================================

interface BatchCreateRequest {
  intentIds: string[];
  assigneeId: string;
  customerId: number;
  customerName: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: wrapupId } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not configured' },
        { status: 500 }
      );
    }

    const body: BatchCreateRequest = await request.json();

    // Validate required fields
    if (!body.intentIds || body.intentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No intents selected' },
        { status: 400 }
      );
    }

    if (!body.assigneeId) {
      return NextResponse.json(
        { success: false, error: 'assigneeId is required' },
        { status: 400 }
      );
    }

    if (!body.customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      );
    }

    // Get the assignee's AgencyZoom ID
    const [assignee] = await db
      .select({ agencyzoomId: users.agencyzoomId })
      .from(users)
      .where(eq(users.id, body.assigneeId))
      .limit(1);

    if (!assignee?.agencyzoomId) {
      return NextResponse.json(
        { success: false, error: 'Assignee not found or not linked to AgencyZoom' },
        { status: 400 }
      );
    }

    const azAssigneeId = parseInt(assignee.agencyzoomId);

    // Get the selected intents
    const intents = await db
      .select()
      .from(callIntents)
      .where(
        and(
          eq(callIntents.wrapupDraftId, wrapupId)
        )
      );

    const selectedIntents = intents.filter((i) => body.intentIds.includes(i.id));

    if (selectedIntents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid intents found' },
        { status: 400 }
      );
    }

    // Check if any intents already have tickets
    const alreadyCreated = selectedIntents.filter((i) => i.ticketCreated);
    if (alreadyCreated.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${alreadyCreated.length} intent(s) already have tickets created`,
        },
        { status: 400 }
      );
    }

    // Get AgencyZoom client
    const azClient = getAgencyZoomClient();

    // Create tickets for each intent
    const results: Array<{
      intentId: string;
      success: boolean;
      ticketId?: number;
      error?: string;
    }> = [];

    for (const intent of selectedIntents) {
      try {
        // Build ticket subject
        const subject = `${intent.requestType || 'Service Request'}: ${
          intent.summary?.substring(0, 60) || 'Multi-intent call'
        }`;

        // Determine category and priority
        const categoryId = intent.categoryId || SERVICE_CATEGORIES.GENERAL_SERVICE;
        const priorityId = intent.priorityId || SERVICE_PRIORITIES.STANDARD;

        // Post note first
        await azClient.addNote(
          body.customerId,
          `[Service Ticket Created - Multi-Intent Call]\n\n${intent.description || intent.summary || 'Service request from call'}`
        );

        // Create the ticket
        const ticketResponse = await azClient.createServiceTicket({
          subject,
          customerId: body.customerId,
          pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
          stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
          csrId: azAssigneeId,
          categoryId,
          priorityId,
          dueDate: getDefaultDueDate(),
        });

        if (!ticketResponse?.serviceTicketId) {
          throw new Error('No ticket ID returned from AgencyZoom');
        }

        const azTicketId = ticketResponse.serviceTicketId;

        // Save to local database
        await db.insert(serviceTickets).values({
          tenantId,
          azTicketId,
          azHouseholdId: body.customerId,
          wrapupDraftId: wrapupId,
          subject,
          description: intent.description,
          status: 'active',
          pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
          pipelineName: 'Policy Service',
          stageId: PIPELINE_STAGES.POLICY_SERVICE_NEW,
          stageName: 'New',
          categoryId,
          priorityId,
          csrId: azAssigneeId,
          source: 'multi_intent',
          azCreatedAt: new Date(),
        });

        // Update the intent record
        await db
          .update(callIntents)
          .set({
            ticketCreated: true,
            azTicketId,
            updatedAt: new Date(),
          })
          .where(eq(callIntents.id, intent.id));

        results.push({
          intentId: intent.id,
          success: true,
          ticketId: azTicketId,
        });

        console.log(
          `[Intents API] Created ticket ${azTicketId} for intent ${intent.id}`
        );
      } catch (intentError: any) {
        console.error(
          `[Intents API] Error creating ticket for intent ${intent.id}:`,
          intentError
        );
        results.push({
          intentId: intent.id,
          success: false,
          error: intentError.message || 'Failed to create ticket',
        });
      }
    }

    // Count successes and failures
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failureCount === 0,
      data: {
        results,
        summary: {
          total: results.length,
          created: successCount,
          failed: failureCount,
        },
      },
    });
  } catch (error) {
    console.error('[Intents API] Error in batch create:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tickets' },
      { status: 500 }
    );
  }
}
