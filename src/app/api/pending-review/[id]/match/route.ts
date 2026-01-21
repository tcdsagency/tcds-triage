import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { wrapupDrafts, messages, triageItems } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * POST /api/pending-review/[id]/match
 * Manually match a pending item to a customer/lead
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;
    const body = await request.json();
    const {
      itemType, // 'wrapup' or 'message'
      customerId, // AgencyZoom customer ID
      customerName, // For display
      isLead,
    } = body;

    if (!itemType || !customerId) {
      return NextResponse.json(
        { error: 'itemType and customerId are required' },
        { status: 400 }
      );
    }

    if (itemType === 'wrapup') {
      // Update wrapup draft with the matched customer/lead
      // Build the JSON object to merge - use correct field based on isLead flag
      const matchData = isLead
        ? {
            agencyZoomLeadId: String(customerId),
            manuallyMatched: true,
            matchedCustomerName: customerName || '',
            isLead: true,
          }
        : {
            agencyZoomCustomerId: String(customerId),
            manuallyMatched: true,
            matchedCustomerName: customerName || '',
            isLead: false,
          };

      // First get the current aiExtraction
      const current = await db.query.wrapupDrafts.findFirst({
        where: eq(wrapupDrafts.id, itemId),
        columns: { aiExtraction: true },
      });

      // Merge the match data with existing aiExtraction
      const mergedExtraction = {
        ...(current?.aiExtraction as Record<string, unknown> || {}),
        ...matchData,
      };

      // Use raw SQL to update - Drizzle ORM has issues with jsonb updates
      const result = await db.execute(sql`
        UPDATE wrapup_drafts
        SET ai_extraction = ${JSON.stringify(mergedExtraction)}::jsonb,
            match_status = 'matched'
        WHERE id = ${itemId}::uuid
        RETURNING id, match_status, customer_name, ai_extraction
      `);

      if (!result || result.length === 0) {
        return NextResponse.json({ error: 'Wrapup not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Wrapup matched to customer',
        item: result[0],
        reminder: 'Please verify the customer\'s phone number is correct in AgencyZoom, as auto-match did not work.',
      });
    }

    if (itemType === 'message') {
      // Update message with the matched contact
      // Ensure customerId is a string for the varchar field
      console.log('[Match] Attempting to match message/triage item:', { itemId, customerId, customerName });

      let [updated] = await db
        .update(messages)
        .set({
          contactId: String(customerId),
          contactName: customerName || null,
        })
        .where(eq(messages.id, itemId))
        .returning();

      // If not found, check if this is a triage item ID (after-hours items use triage ID)
      if (!updated) {
        console.log('[Match] Message not found directly, checking triage_items table...');
        const triageItem = await db.query.triageItems.findFirst({
          where: eq(triageItems.id, itemId),
          columns: { id: true, messageId: true, customerId: true },
        });
        console.log('[Match] Triage item lookup result:', triageItem);

        if (triageItem?.messageId) {
          // Update the linked message
          console.log('[Match] Found triage item with messageId:', triageItem.messageId);
          [updated] = await db
            .update(messages)
            .set({
              contactId: String(customerId),
              contactName: customerName || null,
            })
            .where(eq(messages.id, triageItem.messageId))
            .returning();
          console.log('[Match] Updated linked message:', updated?.id);
        } else if (triageItem) {
          // Triage item exists but has no linked message - just mark as successful
          console.log('[Match] Triage item found but no linked messageId, marking match as successful');
          return NextResponse.json({
            success: true,
            message: 'Triage item matched to customer (no linked message)',
            item: { id: itemId, contactId: String(customerId), contactName: customerName },
            reminder: 'Please verify the customer\'s phone number is correct in AgencyZoom, as auto-match did not work.',
          });
        }
      }

      if (!updated) {
        console.log('[Match] Failed to find message or triage item for ID:', itemId);
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Message matched to customer',
        item: updated,
        reminder: 'Please verify the customer\'s phone number is correct in AgencyZoom, as auto-match did not work.',
      });
    }

    return NextResponse.json({ error: 'Invalid itemType' }, { status: 400 });
  } catch (error) {
    console.error('[Match Update] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Match update failed' },
      { status: 500 }
    );
  }
}
