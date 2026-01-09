// API Route: /api/messages/backfill-contacts
// Backfill contact names for messages that have phone numbers but no contact info

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, customers } from "@/db/schema";
import { eq, and, isNull, isNotNull, or, ilike, sql } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// =============================================================================
// POST - Backfill contact names for messages with null contactName
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 100, 500); // Max 500 per run
    const useApi = body.useApi ?? false; // Whether to also check AgencyZoom API

    // Find messages with phone numbers but no contact name
    const messagesToUpdate = await db
      .select({
        id: messages.id,
        fromNumber: messages.fromNumber,
        toNumber: messages.toNumber,
        direction: messages.direction,
      })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          isNull(messages.contactName),
          isNotNull(messages.fromNumber)
        )
      )
      .limit(limit);

    console.log(`[Backfill] Found ${messagesToUpdate.length} messages to process`);

    let updated = 0;
    let skipped = 0;
    const phoneCache = new Map<string, { id: string; name: string; type: "customer" | "lead" } | null>();

    for (const msg of messagesToUpdate) {
      // For inbound, use fromNumber; for outbound, use toNumber
      const phone = msg.direction === "inbound" ? msg.fromNumber : msg.toNumber;
      if (!phone) {
        skipped++;
        continue;
      }

      const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

      // Check cache first
      if (phoneCache.has(normalizedPhone)) {
        const cached = phoneCache.get(normalizedPhone);
        if (cached) {
          await db
            .update(messages)
            .set({
              contactId: cached.id,
              contactName: cached.name,
              contactType: cached.type,
            })
            .where(eq(messages.id, msg.id));
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      // Check local database
      const [localContact] = await db
        .select({
          id: customers.id,
          agencyzoomId: customers.agencyzoomId,
          firstName: customers.firstName,
          lastName: customers.lastName,
          isLead: customers.isLead,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            or(
              ilike(customers.phone, `%${normalizedPhone}%`),
              ilike(customers.phoneAlt, `%${normalizedPhone}%`)
            )
          )
        )
        .limit(1);

      if (localContact) {
        const contactInfo = {
          id: localContact.agencyzoomId || localContact.id,
          name: `${localContact.firstName} ${localContact.lastName}`.trim(),
          type: (localContact.isLead ? "lead" : "customer") as "customer" | "lead",
        };
        phoneCache.set(normalizedPhone, contactInfo);

        await db
          .update(messages)
          .set({
            contactId: contactInfo.id,
            contactName: contactInfo.name,
            contactType: contactInfo.type,
          })
          .where(eq(messages.id, msg.id));
        updated++;
        continue;
      }

      // Optionally check AgencyZoom API
      if (useApi) {
        try {
          const azClient = getAgencyZoomClient();

          // Try customer first
          const customer = await azClient.findCustomerByPhone(phone);
          if (customer) {
            const contactInfo = {
              id: customer.id.toString(),
              name: `${customer.firstName} ${customer.lastName}`.trim(),
              type: "customer" as const,
            };
            phoneCache.set(normalizedPhone, contactInfo);

            await db
              .update(messages)
              .set({
                contactId: contactInfo.id,
                contactName: contactInfo.name,
                contactType: contactInfo.type,
              })
              .where(eq(messages.id, msg.id));
            updated++;
            continue;
          }

          // Try lead
          const lead = await azClient.findLeadByPhone(phone);
          if (lead) {
            const contactInfo = {
              id: lead.id.toString(),
              name: `${lead.firstName} ${lead.lastName}`.trim(),
              type: "lead" as const,
            };
            phoneCache.set(normalizedPhone, contactInfo);

            await db
              .update(messages)
              .set({
                contactId: contactInfo.id,
                contactName: contactInfo.name,
                contactType: contactInfo.type,
              })
              .where(eq(messages.id, msg.id));
            updated++;
            continue;
          }
        } catch (error) {
          console.warn("[Backfill] AgencyZoom lookup failed for", phone, error);
        }
      }

      // Not found
      phoneCache.set(normalizedPhone, null);
      skipped++;
    }

    // Get remaining count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          isNull(messages.contactName),
          isNotNull(messages.fromNumber)
        )
      );

    return NextResponse.json({
      success: true,
      processed: messagesToUpdate.length,
      updated,
      skipped,
      remaining: Number(count),
    });
  } catch (error) {
    console.error("[Backfill] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Check how many messages need backfill
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.tenantId, tenantId));

    const [{ needsBackfill }] = await db
      .select({ needsBackfill: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          isNull(messages.contactName),
          isNotNull(messages.fromNumber)
        )
      );

    const [{ hasContact }] = await db
      .select({ hasContact: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          isNotNull(messages.contactName)
        )
      );

    return NextResponse.json({
      total: Number(total),
      needsBackfill: Number(needsBackfill),
      hasContact: Number(hasContact),
      percentComplete: total > 0 ? Math.round((Number(hasContact) / Number(total)) * 100) : 100,
    });
  } catch (error) {
    console.error("[Backfill] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Check failed" },
      { status: 500 }
    );
  }
}
