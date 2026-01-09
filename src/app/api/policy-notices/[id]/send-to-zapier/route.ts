/**
 * API Route: /api/policy-notices/[id]/send-to-zapier
 * ===================================================
 * Sends a policy notice to Zapier webhook for AgencyZoom service ticket creation.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  policyNotices,
  policyNoticeWebhookDeliveries,
  customers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

interface ZapierPayload {
  event: 'policy_notice.actioned';
  timestamp: string;
  notice: {
    id: string;
    type: string | null;
    policyNumber: string | null;
    insuredName: string | null;
    carrier: string | null;
    lineOfBusiness: string | null;
    title: string;
    description: string | null;
    amountDue: string | null;
    dueDate: string | null;
    claimNumber: string | null;
    urgency: string | null;
    actionTaken: string | null;
    actionDetails: string | null;
    reviewNotes: string | null;
  };
  customer: {
    agencyzoomId: string | null;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  agencyzoom: {
    serviceRequestSubject: string;
    serviceRequestDescription: string;
    priority: number;
  };
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const webhookUrl = process.env.ZAPIER_POLICY_NOTICE_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Zapier webhook URL not configured" },
        { status: 500 }
      );
    }

    const [notice] = await db
      .select()
      .from(policyNotices)
      .where(
        and(eq(policyNotices.id, id), eq(policyNotices.tenantId, tenantId))
      );

    if (!notice) {
      return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    }

    if (notice.zapierWebhookSent) {
      return NextResponse.json(
        {
          error: "Webhook already sent for this notice",
          sentAt: notice.zapierWebhookSentAt,
        },
        { status: 400 }
      );
    }

    let customer = null;
    if (notice.customerId) {
      const [cust] = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          email: customers.email,
          phone: customers.phone,
          agencyzoomId: customers.agencyzoomId,
        })
        .from(customers)
        .where(eq(customers.id, notice.customerId));
      customer = cust;
    }

    const urgencyToPriority: Record<string, number> = {
      urgent: 1,
      high: 2,
      medium: 3,
      low: 4,
    };

    const typePrefix = notice.noticeType?.toUpperCase() || 'NOTICE';
    const subject = `[${typePrefix}] ${notice.title}`;

    const descriptionParts: string[] = [];
    descriptionParts.push(`**Notice Type:** ${notice.noticeType}`);
    descriptionParts.push(`**Policy:** ${notice.policyNumber || 'N/A'}`);
    descriptionParts.push(`**Carrier:** ${notice.carrier || 'N/A'}`);
    descriptionParts.push(`**Insured:** ${notice.insuredName || 'N/A'}`);

    if (notice.amountDue) {
      descriptionParts.push(`**Amount Due:** $${notice.amountDue}`);
    }
    if (notice.dueDate) {
      descriptionParts.push(`**Due Date:** ${notice.dueDate}`);
    }
    if (notice.claimNumber) {
      descriptionParts.push(`**Claim Number:** ${notice.claimNumber}`);
    }
    if (notice.description) {
      descriptionParts.push(`\n**Description:**\n${notice.description}`);
    }
    if (notice.reviewNotes) {
      descriptionParts.push(`\n**Review Notes:**\n${notice.reviewNotes}`);
    }
    if (notice.actionTaken) {
      descriptionParts.push(`\n**Action Taken:** ${notice.actionTaken}`);
    }
    if (notice.actionDetails) {
      descriptionParts.push(`**Action Details:** ${notice.actionDetails}`);
    }

    const payload: ZapierPayload = {
      event: 'policy_notice.actioned',
      timestamp: new Date().toISOString(),
      notice: {
        id: notice.id,
        type: notice.noticeType,
        policyNumber: notice.policyNumber,
        insuredName: notice.insuredName,
        carrier: notice.carrier,
        lineOfBusiness: notice.lineOfBusiness,
        title: notice.title,
        description: notice.description,
        amountDue: notice.amountDue,
        dueDate: notice.dueDate,
        claimNumber: notice.claimNumber,
        urgency: notice.urgency,
        actionTaken: notice.actionTaken,
        actionDetails: notice.actionDetails,
        reviewNotes: notice.reviewNotes,
      },
      customer: customer
        ? {
            agencyzoomId: customer.agencyzoomId,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
          }
        : null,
      agencyzoom: {
        serviceRequestSubject: subject,
        serviceRequestDescription: descriptionParts.join('\n'),
        priority: urgencyToPriority[notice.urgency || 'medium'] || 3,
      },
    };

    const [delivery] = await db
      .insert(policyNoticeWebhookDeliveries)
      .values({
        tenantId,
        policyNoticeId: notice.id,
        webhookUrl,
        payload,
        status: 'pending',
        attemptCount: 1,
      })
      .returning();

    let success = false;
    let httpStatus: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      httpStatus = response.status;
      responseBody = await response.text();
      success = response.ok;

      if (!success) {
        errorMessage = `HTTP ${response.status}: ${responseBody}`;
      }
    } catch (fetchError) {
      errorMessage =
        fetchError instanceof Error ? fetchError.message : 'Fetch failed';
    }

    const now = new Date();

    await db
      .update(policyNoticeWebhookDeliveries)
      .set({
        status: success ? 'success' : 'failed',
        httpStatus,
        responseBody,
        errorMessage,
        sentAt: now,
        updatedAt: now,
        nextRetryAt: success
          ? null
          : new Date(Date.now() + 5 * 60 * 1000),
      })
      .where(eq(policyNoticeWebhookDeliveries.id, delivery.id));

    await db
      .update(policyNotices)
      .set({
        zapierWebhookSent: success,
        zapierWebhookSentAt: success ? now : null,
        zapierWebhookStatus: success ? 'success' : 'failed',
        updatedAt: now,
      })
      .where(eq(policyNotices.id, notice.id));

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Webhook sent successfully',
        deliveryId: delivery.id,
        sentAt: now.toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: errorMessage || 'Webhook delivery failed',
          deliveryId: delivery.id,
          willRetry: true,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Error sending to Zapier:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to send webhook',
      },
      { status: 500 }
    );
  }
}
