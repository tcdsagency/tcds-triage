/**
 * SMS Relay API for 3CX Integration
 * ==================================
 * This endpoint allows 3CX to send SMS messages through AgencyZoom,
 * keeping all systems in sync regardless of where messages originate.
 *
 * Flow:
 * 1. 3CX sends SMS request to this relay
 * 2. We look up the customer/lead in our database
 * 3. Send via AgencyZoom API (appears in AZ conversation history)
 * 4. Store in local messages table for Triage SMS view
 * 5. Return success/failure to 3CX
 *
 * POST /api/sms/relay
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, customers } from "@/db/schema";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { eq, or, sql } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface RelaySMSRequest {
  to: string;           // Recipient phone number
  message: string;      // Message body
  from?: string;        // Sender name (optional, defaults to agent)
  agentExtension?: string; // 3CX extension of sending agent
  // Authentication
  apiKey?: string;      // API key for authentication
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key') ||
                 request.headers.get('authorization')?.replace('Bearer ', '');

  const expectedKey = process.env.SMS_RELAY_API_KEY || process.env.VOIPTOOLS_PUBLIC_KEY;

  if (!expectedKey) {
    console.warn('[SMS Relay] No API key configured - allowing request');
    return true; // Allow if no key configured (dev mode)
  }

  return apiKey === expectedKey;
}

// =============================================================================
// POST - Relay SMS via AgencyZoom
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - invalid API key' },
        { status: 401 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not configured' },
        { status: 500 }
      );
    }

    const body: RelaySMSRequest = await request.json();

    if (!body.to || !body.message) {
      return NextResponse.json(
        { success: false, error: 'Phone number (to) and message are required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalizedPhone = body.to.replace(/\D/g, '').slice(-10);
    if (normalizedPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    console.log(`[SMS Relay] Received from 3CX: to=${normalizedPhone}, agent=${body.agentExtension}`);

    // Look up customer by phone number
    let contactId: number | undefined;
    let contactName: string | undefined;
    let contactType: 'customer' | 'lead' = 'customer';

    try {
      // Search for customer by phone number
      const customer = await db.query.customers.findFirst({
        where: or(
          sql`${customers.phone} LIKE ${'%' + normalizedPhone}`,
          sql`${customers.phoneAlt} LIKE ${'%' + normalizedPhone}`
        ),
      });

      if (customer) {
        contactId = customer.agencyzoomId ? parseInt(customer.agencyzoomId) : undefined;
        contactName = `${customer.firstName} ${customer.lastName}`.trim();
        contactType = 'customer';
        console.log(`[SMS Relay] Found customer: ${contactName} (AZ ID: ${contactId})`);
      } else {
        console.log(`[SMS Relay] No customer found for ${normalizedPhone}`);
      }
    } catch (lookupError) {
      console.error('[SMS Relay] Customer lookup error:', lookupError);
      // Continue without contact info
    }

    // Send via AgencyZoom
    let sendResult: { success: boolean; messageId?: string; error?: string };

    try {
      const azClient = getAgencyZoomClient();
      sendResult = await azClient.sendSMS({
        phoneNumber: normalizedPhone,
        message: body.message,
        contactId: contactId,
        contactType: contactType,
        fromName: body.from || 'TCDS Insurance',
      });
    } catch (azError) {
      console.error('[SMS Relay] AgencyZoom error:', azError);
      sendResult = {
        success: false,
        error: azError instanceof Error ? azError.message : 'AgencyZoom SMS failed',
      };
    }

    if (!sendResult.success) {
      console.error(`[SMS Relay] Failed to send: ${sendResult.error}`);
      return NextResponse.json(
        { success: false, error: sendResult.error },
        { status: 500 }
      );
    }

    // Store in local messages table for Triage SMS view
    try {
      await db.insert(messages).values({
        tenantId,
        type: 'sms',
        direction: 'outbound',
        fromNumber: process.env.TWILIO_PHONE_NUMBER || '+1XXXXXXXXXX',
        toNumber: `+1${normalizedPhone}`,
        body: body.message,
        externalId: sendResult.messageId,
        status: 'sent',
        contactId: contactId?.toString(),
        contactName: contactName,
        contactType: contactType,
        isAcknowledged: true,
        sentAt: new Date(),
        metadata: {
          source: '3cx',
          agentExtension: body.agentExtension,
          relayedAt: new Date().toISOString(),
        },
      });
    } catch (dbError) {
      console.error('[SMS Relay] Failed to store message:', dbError);
      // Don't fail the request - SMS was sent
    }

    console.log(`[SMS Relay] Success: sent to ${normalizedPhone} via AgencyZoom`);

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      contactId: contactId,
      contactName: contactName,
    });

  } catch (error) {
    console.error('[SMS Relay] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Relay failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Health check / API info
// =============================================================================

export async function GET() {
  return NextResponse.json({
    name: 'SMS Relay API',
    version: '1.0',
    description: 'Relay SMS from 3CX through AgencyZoom',
    endpoints: {
      'POST /api/sms/relay': {
        description: 'Send SMS via AgencyZoom',
        headers: {
          'x-api-key': 'Required - API key for authentication',
          'Content-Type': 'application/json',
        },
        body: {
          to: 'string (required) - Recipient phone number',
          message: 'string (required) - Message body',
          from: 'string (optional) - Sender name',
          agentExtension: 'string (optional) - 3CX extension',
        },
        response: {
          success: 'boolean',
          messageId: 'string (on success)',
          contactId: 'number (if customer found)',
          contactName: 'string (if customer found)',
          error: 'string (on failure)',
        },
      },
    },
  });
}
