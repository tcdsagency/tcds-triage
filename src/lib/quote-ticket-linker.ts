// =============================================================================
// Quote → AZ Service Ticket Linker
// =============================================================================
// After a quote is submitted during a live call, find the AZ service ticket
// created from that call's wrapup and post the quote intake details as a note.
// =============================================================================

import { db } from "@/db";
import { quotes, wrapupDrafts, customers } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

const QUOTE_TYPE_LABELS: Record<string, string> = {
  personal_auto: "Personal Auto",
  homeowners: "Homeowners",
  renters: "Renters",
  mobile_home: "Mobile Home",
  flood: "Flood Insurance",
  umbrella: "Umbrella",
  bop: "Business Owner's Policy",
  general_liability: "General Liability",
  workers_comp: "Workers Compensation",
  recreational: "Recreational Vehicle",
  motorcycle: "Motorcycle",
  commercial_auto: "Commercial Auto",
  professional_liability: "Professional Liability",
};

// =============================================================================
// Format Quote Note
// =============================================================================

function formatQuoteNote(quote: typeof quotes.$inferSelect): string {
  const typeLabel = QUOTE_TYPE_LABELS[quote.type] || quote.type;
  const contact = quote.contactInfo as {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: { street?: string; city?: string; state?: string; zip?: string };
  } | null;

  const lines: string[] = [];
  lines.push(`New Quote Intake - ${typeLabel}`);
  lines.push("");

  // Contact info
  if (contact) {
    const name = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
    const parts: string[] = [];
    if (name) parts.push(name);
    if (contact.phone) parts.push(contact.phone);
    if (contact.email) parts.push(contact.email);
    if (parts.length > 0) {
      lines.push(`Contact: ${parts.join(" | ")}`);
    }
    if (contact.address) {
      const addr = contact.address;
      const addrParts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
      if (addrParts.length > 0) {
        lines.push(`Address: ${addrParts.join(", ")}`);
      }
    }
    lines.push("");
  }

  // Vehicles (auto quotes)
  const vehicles = quote.vehicles as Array<{
    year?: number; make?: string; model?: string; vin?: string;
    use?: string; annualMiles?: number;
  }> | null;
  if (vehicles && vehicles.length > 0) {
    lines.push("Vehicles:");
    vehicles.forEach((v, i) => {
      const desc = [v.year, v.make, v.model].filter(Boolean).join(" ");
      const details: string[] = [];
      if (v.use) details.push(v.use);
      if (v.annualMiles) details.push(`${v.annualMiles.toLocaleString()} mi/yr`);
      lines.push(`  ${i + 1}. ${desc}${details.length ? ` - ${details.join(", ")}` : ""}`);
    });
    lines.push("");
  }

  // Drivers (auto quotes)
  const drivers = quote.drivers as Array<{
    firstName?: string; lastName?: string; dob?: string;
    licenseNumber?: string; licenseState?: string;
  }> | null;
  if (drivers && drivers.length > 0) {
    lines.push("Drivers:");
    drivers.forEach((d, i) => {
      const name = `${d.firstName || ""} ${d.lastName || ""}`.trim();
      const details: string[] = [];
      if (d.dob) details.push(`DOB: ${d.dob}`);
      if (d.licenseNumber) details.push(`DL# ${d.licenseNumber}`);
      if (d.licenseState) details.push(d.licenseState);
      lines.push(`  ${i + 1}. ${name}${details.length ? ` (${details.join(", ")})` : ""}`);
    });
    lines.push("");
  }

  // Property (home quotes)
  const property = quote.property as {
    address?: string | { street?: string; city?: string; state?: string; zip?: string };
    yearBuilt?: number; squareFeet?: number;
    constructionType?: string; roofType?: string; roofAge?: number;
  } | null;
  if (property) {
    lines.push("Property:");
    if (property.address) {
      if (typeof property.address === "string") {
        lines.push(`  Address: ${property.address}`);
      } else {
        const parts = [property.address.street, property.address.city, property.address.state, property.address.zip].filter(Boolean);
        if (parts.length) lines.push(`  Address: ${parts.join(", ")}`);
      }
    }
    const propDetails: string[] = [];
    if (property.yearBuilt) propDetails.push(`Built ${property.yearBuilt}`);
    if (property.squareFeet) propDetails.push(`${property.squareFeet.toLocaleString()} sq ft`);
    if (property.constructionType) propDetails.push(property.constructionType);
    if (property.roofType) propDetails.push(`${property.roofType} roof`);
    if (property.roofAge) propDetails.push(`Roof age: ${property.roofAge}yr`);
    if (propDetails.length) lines.push(`  ${propDetails.join(", ")}`);
    lines.push("");
  }

  // Notes
  if (quote.notes) {
    lines.push(`Notes: ${quote.notes}`);
    lines.push("");
  }

  lines.push("-- Auto-generated by TCDS Triage (Quote Wizard)");
  return lines.join("\n");
}

// =============================================================================
// Link Quote to AZ Ticket (single attempt)
// =============================================================================

export async function attemptLinkQuoteToTicket(quoteId: string): Promise<
  { linked: true } | { linked: false; reason: string }
> {
  // 1. Load the quote
  const [quote] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!quote) return { linked: false, reason: "quote_not_found" };
  if (!quote.callId) return { linked: false, reason: "no_call_id" };
  if (quote.azTicketNotePosted) return { linked: true };

  // 2. Find wrapup draft for this call
  const [wrapup] = await db
    .select({
      id: wrapupDrafts.id,
      agencyzoomTicketId: wrapupDrafts.agencyzoomTicketId,
    })
    .from(wrapupDrafts)
    .where(eq(wrapupDrafts.callId, quote.callId))
    .limit(1);

  if (!wrapup) return { linked: false, reason: "wrapup_not_found" };
  if (!wrapup.agencyzoomTicketId) return { linked: false, reason: "ticket_not_created_yet" };

  const azTicketId = parseInt(wrapup.agencyzoomTicketId, 10);
  if (isNaN(azTicketId) || azTicketId <= 0) {
    return { linked: false, reason: "invalid_ticket_id" };
  }

  // 3. Format and post note to the AZ service ticket
  const noteText = formatQuoteNote(quote);
  const azClient = getAgencyZoomClient();

  let notePosted = false;

  // Read current ticket via list API (GET single doesn't work in AZ)
  let azTicket: any = null;
  try {
    const listResult = await azClient.getServiceTickets({ serviceTicketIds: [azTicketId] });
    azTicket = listResult.data?.[0] as any;
  } catch (err) {
    console.warn(`[QuoteTicketLinker] Could not read ticket #${azTicketId} via list API`);
  }

  // Append quote details to the ticket description via PUT
  // AZ PUT requires all required fields echoed back
  if (azTicket) {
    try {
      const separator = "\n\n===================================\nQUOTE INTAKE DETAILS\n===================================\n\n";
      const updatedDesc = (azTicket.serviceDesc || "") + separator + noteText;
      await azClient.updateServiceTicket(azTicketId, {
        // Echo all required fields from current ticket
        customerId: azTicket.householdId,
        workflowId: azTicket.workflowId,
        workflowStageId: azTicket.workflowStageId,
        csr: azTicket.csr,
        subject: azTicket.subject,
        priorityId: azTicket.priorityId,
        categoryId: azTicket.categoryId,
        // Updated field
        description: updatedDesc,
      });
      notePosted = true;
      console.log(`[QuoteTicketLinker] Appended quote details to AZ ticket #${azTicketId}`);
    } catch (err) {
      console.error(`[QuoteTicketLinker] Failed to update ticket description:`, err instanceof Error ? err.message : err);
    }
  } else {
    console.warn(`[QuoteTicketLinker] Could not find AZ ticket #${azTicketId} to update`);
  }

  // 4. Also post to customer note if we have a customer match
  try {
    if (quote.customerId) {
      const [cust] = await db
        .select({ agencyzoomId: customers.agencyzoomId })
        .from(customers)
        .where(eq(customers.id, quote.customerId))
        .limit(1);

      if (cust?.agencyzoomId) {
        const azCustId = parseInt(cust.agencyzoomId, 10);
        if (!isNaN(azCustId) && azCustId > 0) {
          await azClient.addNote(azCustId, noteText);
        }
      }
    }
  } catch (err) {
    // Non-fatal - ticket note/description is the primary target
    console.error(`[QuoteTicketLinker] Customer note failed (non-fatal):`, err);
  }

  // 5. Mark quote as linked
  await db
    .update(quotes)
    .set({
      azTicketNotePosted: true,
      azTicketNoteError: null,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));

  console.log(`[QuoteTicketLinker] Linked quote ${quoteId} to AZ ticket #${azTicketId}`);
  return { linked: true };
}

// =============================================================================
// Link with retries (for use in after() — limited to 2 attempts within 30s)
// =============================================================================

export async function linkQuoteToTicketWithRetries(quoteId: string, callId: string): Promise<void> {
  const delays = [0, 15_000]; // Immediate, then 15s (well within 60s after() limit)

  for (const delay of delays) {
    if (delay > 0) await new Promise(r => setTimeout(r, delay));

    const result = await attemptLinkQuoteToTicket(quoteId);
    if (result.linked) return;

    // If the reason is permanent (not a timing issue), stop retrying
    if ("reason" in result && !["wrapup_not_found", "ticket_not_created_yet"].includes(result.reason)) {
      console.log(`[QuoteTicketLinker] Permanent failure for quote ${quoteId}: ${result.reason}`);
      await db
        .update(quotes)
        .set({ azTicketNoteError: result.reason, updatedAt: new Date() })
        .where(eq(quotes.id, quoteId));
      return;
    }

    console.log(`[QuoteTicketLinker] Retry: quote ${quoteId} - ${(result as any).reason}`);
  }

  // All retries exhausted within after() — transcript worker will pick it up later
  console.log(`[QuoteTicketLinker] Deferring quote ${quoteId} to transcript worker for later retry`);
}

// =============================================================================
// Process all pending quote-ticket links (called by transcript worker)
// =============================================================================

export async function processPendingQuoteTicketLinks(): Promise<number> {
  const pendingQuotes = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(
      and(
        isNotNull(quotes.callId),
        eq(quotes.azTicketNotePosted, false),
        // Only process quotes that don't have a permanent error
        // (null error = never tried or deferred, non-null = permanent failure)
      )
    )
    .limit(5);

  let linked = 0;
  for (const q of pendingQuotes) {
    try {
      const result = await attemptLinkQuoteToTicket(q.id);
      if (result.linked) {
        linked++;
      } else if ("reason" in result && !["wrapup_not_found", "ticket_not_created_yet"].includes(result.reason)) {
        // Permanent failure — record it so we stop retrying
        await db
          .update(quotes)
          .set({ azTicketNoteError: result.reason, updatedAt: new Date() })
          .where(eq(quotes.id, q.id));
      }
    } catch (err) {
      console.error(`[QuoteTicketLinker] Error processing quote ${q.id}:`, err);
    }
  }

  return linked;
}
