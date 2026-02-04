/**
 * GET/POST /api/renewals/[id]/notes
 * Merged notes from audit log + AZ SR.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRenewalAuditHistory } from '@/lib/api/renewal-audit';
import { addRenewalNote } from '@/lib/api/renewal-state-machine';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auditHistory = await getRenewalAuditHistory(id);

    const notes = auditHistory
      .filter((e) =>
        e.eventType === 'note_posted' ||
        e.eventType === 'agent_decision' ||
        e.eventType === 'sr_moved'
      )
      .map((e) => {
        const data = e.eventData as Record<string, any> | null;
        let content = '';
        let type: 'system' | 'agent' = 'system';

        if (e.eventType === 'note_posted') {
          content = data?.content || '';
          type = e.performedBy && e.performedBy !== 'system' ? 'agent' : 'system';
        } else if (e.eventType === 'agent_decision') {
          const decision = (data?.decision || '').replace(/_/g, ' ');
          content = `Decision: ${decision}${data?.notes ? `\n${data.notes}` : ''}`;
          type = 'agent';
        } else if (e.eventType === 'sr_moved') {
          content = `Moved to stage: ${(data?.targetStage || '').replace(/_/g, ' ')}`;
        }

        return {
          id: e.id,
          type,
          content,
          author: e.performedBy,
          createdAt: e.performedAt,
        };
      });

    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error('[API] Error fetching notes:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, userId, userName } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Note content is required' },
        { status: 400 }
      );
    }

    const result = await addRenewalNote(
      TENANT_ID,
      id,
      content,
      userName || 'Agent',
      userId
    );

    return NextResponse.json({
      success: result.success,
      warning: result.warning,
    });
  } catch (error) {
    console.error('[API] Error posting note:', error);
    return NextResponse.json({ success: false, error: 'Failed to post note' }, { status: 500 });
  }
}
