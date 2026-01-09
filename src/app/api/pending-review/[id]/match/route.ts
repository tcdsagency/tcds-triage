import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { wrapupDrafts, messages } from '@/db/schema';
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

      const [updated] = await db
        .update(wrapupDrafts)
        .set({
          // Store in aiExtraction for compatibility with existing flow
          aiExtraction: sql`
            COALESCE(${wrapupDrafts.aiExtraction}, '{}'::jsonb) || ${JSON.stringify(matchData)}::jsonb
          `,
          matchStatus: 'matched',
        })
        .where(eq(wrapupDrafts.id, itemId))
        .returning();

      if (!updated) {
        return NextResponse.json({ error: 'Wrapup not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Wrapup matched to customer',
        item: updated,
        reminder: 'Please verify the customer\'s phone number is correct in AgencyZoom, as auto-match did not work.',
      });
    }

    if (itemType === 'message') {
      // Update message with the matched contact
      const [updated] = await db
        .update(messages)
        .set({
          contactId: customerId,
          contactName: customerName || null,
        })
        .where(eq(messages.id, itemId))
        .returning();

      if (!updated) {
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
