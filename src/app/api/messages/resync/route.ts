// API Route: /api/messages/resync
// Resync contact information for messages with unknown contacts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, customers } from "@/db/schema";
import { eq, and, or, isNull, ilike, sql } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// =============================================================================
// POST - Resync Contacts for Messages
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Find messages with no contactName or "unknown" contactName
    const messagesToResync = await db
      .select({
        id: messages.id,
        fromNumber: messages.fromNumber,
        toNumber: messages.toNumber,
        direction: messages.direction,
        contactId: messages.contactId,
        contactName: messages.contactName,
      })
      .from(messages)
      .where(
        and(
          eq(messages.tenantId, tenantId),
          or(
            isNull(messages.contactName),
            eq(messages.contactName, ""),
            ilike(messages.contactName, "%unknown%")
          )
        )
      )
      .limit(500);

    console.log(`[Resync] Found ${messagesToResync.length} messages to resync`);

    let updated = 0;
    let skipped = 0;
    const azClient = getAgencyZoomClient();
    const phoneCache = new Map<string, { id: string; name: string; type: string } | null>();

    for (const msg of messagesToResync) {
      // Get the phone number (from for inbound, to for outbound)
      const phone = msg.direction === "inbound" ? msg.fromNumber : msg.toNumber;
      if (!phone) {
        skipped++;
        continue;
      }
      const normalizedPhone = phone.replace(/\D/g, "");
      const last10 = normalizedPhone.slice(-10);

      // Check cache first
      if (phoneCache.has(last10)) {
        const cached = phoneCache.get(last10);
        if (cached) {
          await db
            .update(messages)
            .set({
              contactId: cached.id,
              contactName: cached.name,
              contactType: cached.type as "customer" | "lead",
            })
            .where(eq(messages.id, msg.id));
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      // Look up in local database
      let contact: { id: string; name: string; type: string } | null = null;

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
              ilike(customers.phone, `%${last10}%`),
              ilike(customers.phoneAlt, `%${last10}%`)
            )
          )
        )
        .limit(1);

      if (localContact) {
        const firstName = localContact.firstName || "";
        const lastName = localContact.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) {
          contact = {
            id: localContact.agencyzoomId || localContact.id,
            name: fullName,
            type: localContact.isLead ? "lead" : "customer",
          };
        }
      }

      // If not found locally, try AgencyZoom API
      if (!contact) {
        try {
          const azCustomer = await azClient.findCustomerByPhone(phone);
          if (azCustomer) {
            const firstName = azCustomer.firstName || "";
            const lastName = azCustomer.lastName || "";
            const fullName = `${firstName} ${lastName}`.trim();
            if (fullName) {
              contact = {
                id: azCustomer.id.toString(),
                name: fullName,
                type: "customer",
              };
            }
          } else {
            const azLead = await azClient.findLeadByPhone(phone);
            if (azLead) {
              const firstName = azLead.firstName || "";
              const lastName = azLead.lastName || "";
              const fullName = `${firstName} ${lastName}`.trim();
              if (fullName) {
                contact = {
                  id: azLead.id.toString(),
                  name: fullName,
                  type: "lead",
                };
              }
            }
          }
        } catch (error) {
          console.warn("[Resync] AgencyZoom lookup failed:", error);
        }
      }

      // Cache the result (even null)
      phoneCache.set(last10, contact);

      if (contact) {
        await db
          .update(messages)
          .set({
            contactId: contact.id,
            contactName: contact.name,
            contactType: contact.type as "customer" | "lead",
          })
          .where(eq(messages.id, msg.id));
        updated++;
        console.log(`[Resync] Updated message ${msg.id}: ${contact.name}`);
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      total: messagesToResync.length,
      updated,
      skipped,
      message: `Resynced ${updated} messages, skipped ${skipped}`,
    });
  } catch (error) {
    console.error("[Resync] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Resync failed" },
      { status: 500 }
    );
  }
}
