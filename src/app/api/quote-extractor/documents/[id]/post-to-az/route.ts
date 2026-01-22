// API Route: /api/quote-extractor/documents/[id]/post-to-az
// Post extracted quote data to AgencyZoom as a lead with actual quote records

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quoteDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import {
  findCarrierByName,
  findProductLineByQuoteType,
  KNOWN_IDS,
} from "@/lib/api/agencyzoom-reference";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// POST - Create/Update AgencyZoom Lead with Quote
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const {
      pipelineId,
      stageId,
      agentId,
      existingLeadId,
      existingCustomerId,
      // Optional overrides for carrier/product line
      carrierId: overrideCarrierId,
      productLineId: overrideProductLineId,
      // Skip quote creation (just create lead + note)
      skipQuote = false,
    } = body;

    if (!pipelineId || !stageId) {
      return NextResponse.json(
        { success: false, error: "pipelineId and stageId are required" },
        { status: 400 }
      );
    }

    // Get the document
    const [document] = await db
      .select()
      .from(quoteDocuments)
      .where(
        and(
          eq(quoteDocuments.id, id),
          eq(quoteDocuments.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    if (document.status !== "extracted") {
      return NextResponse.json(
        { success: false, error: "Document has not been extracted yet" },
        { status: 400 }
      );
    }

    const azClient = getAgencyZoomClient();
    let leadId = existingLeadId;
    const customerId = existingCustomerId;

    // ==========================================================================
    // Step 1: Map carrier and product line
    // ==========================================================================

    let carrierId = overrideCarrierId ? parseInt(overrideCarrierId) : null;
    let productLineId = overrideProductLineId ? parseInt(overrideProductLineId) : null;
    let carrierName = document.carrierName;
    let productLineName: string | null = document.quoteType;

    // Auto-match carrier if not overridden
    if (!carrierId && document.carrierName) {
      const carrier = await findCarrierByName(document.carrierName);
      if (carrier) {
        carrierId = carrier.id;
        carrierName = carrier.name;
        console.log(`[Quote Extractor] Matched carrier: ${document.carrierName} -> ${carrier.name} (ID: ${carrier.id})`);
      } else {
        console.warn(`[Quote Extractor] Could not match carrier: ${document.carrierName}`);
      }
    }

    // Auto-match product line if not overridden
    if (!productLineId && document.quoteType) {
      const productLine = await findProductLineByQuoteType(document.quoteType);
      if (productLine) {
        productLineId = productLine.id;
        productLineName = productLine.name;
        console.log(`[Quote Extractor] Matched product line: ${document.quoteType} -> ${productLine.name} (ID: ${productLine.id})`);
      } else {
        console.warn(`[Quote Extractor] Could not match product line: ${document.quoteType}`);
      }
    }

    // ==========================================================================
    // Step 2: Search for existing lead/customer if not provided
    // ==========================================================================

    if (!leadId && !customerId) {
      // Try to find existing lead by phone or email
      if (document.customerPhone) {
        try {
          const existingLead = await azClient.findLeadByPhone(document.customerPhone);
          if (existingLead) {
            console.log(`[Quote Extractor] Found existing lead by phone: ${existingLead.id}`);
            leadId = existingLead.id;
          }
        } catch (e) {
          console.warn('[Quote Extractor] Lead search by phone failed:', e);
        }
      }

      // Also check if they're an existing customer
      if (!leadId && document.customerPhone) {
        try {
          const existingCustomer = await azClient.findCustomerByPhone(document.customerPhone);
          if (existingCustomer) {
            console.log(`[Quote Extractor] Found existing customer by phone: ${existingCustomer.id}`);
            // For existing customers, we might want to add a note instead of creating a lead
            // For now, we'll still create a lead but track the customer ID
          }
        } catch (e) {
          console.warn('[Quote Extractor] Customer search by phone failed:', e);
        }
      }
    }

    // ==========================================================================
    // Step 3: Create lead if needed
    // ==========================================================================

    if (!leadId && !customerId) {
      // Parse customer name
      const nameParts = (document.customerName || "Unknown Customer").split(" ");
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "Customer";

      // Use enhanced createLeadFull for full address support
      const leadResult = await azClient.createLeadFull({
        firstName,
        lastName,
        email: document.customerEmail || undefined,
        phone: document.customerPhone || undefined,
        streetAddress: document.customerAddress || undefined,
        city: document.customerCity || undefined,
        state: document.customerState || undefined,
        zip: document.customerZip || undefined,
        leadSourceId: KNOWN_IDS.leadSources.QUOTE_EXTRACTOR,
        assignedTo: agentId ? parseInt(agentId) : undefined,
        pipelineId: parseInt(pipelineId),
        stageId: parseInt(stageId),
        leadType: document.quoteType?.toLowerCase().includes('commercial') ? 'commercial' : 'personal',
      });

      if (!leadResult.success || !leadResult.leadId) {
        console.error('[Quote Extractor] Lead creation failed:', leadResult);
        return NextResponse.json(
          {
            success: false,
            error: leadResult.error || "Failed to create lead in AgencyZoom",
            details: leadResult
          },
          { status: 500 }
        );
      }

      leadId = leadResult.leadId;
      console.log(`[Quote Extractor] Created new lead: ${leadId}`);
    }

    // ==========================================================================
    // Step 4: Calculate items count from vehicles/drivers/properties
    // ==========================================================================

    // Determine items count based on quote type and extracted data
    let itemsCount = 1;
    const quoteTypeLower = (document.quoteType || '').toLowerCase();
    const isAutoQuote = quoteTypeLower.includes('auto') || quoteTypeLower === 'motorcycle';
    const isPropertyQuote = quoteTypeLower.includes('home') || quoteTypeLower.includes('property') ||
                            quoteTypeLower.includes('condo') || quoteTypeLower.includes('renters') ||
                            quoteTypeLower.includes('dwelling');

    if (isAutoQuote) {
      // For auto quotes, items = number of vehicles
      const vehicles = document.vehicleInfo as any[] | null;
      if (vehicles && vehicles.length > 0) {
        itemsCount = vehicles.length;
        console.log(`[Quote Extractor] Auto quote with ${itemsCount} vehicle(s)`);
      }
    } else if (isPropertyQuote) {
      // For property quotes, items = 1 (single property)
      itemsCount = 1;
    }

    // Build vehicle/driver summary for custom fields
    const vehicleSummary = (document.vehicleInfo as any[] || [])
      .map((v, i) => `Vehicle ${i + 1}: ${[v.year, v.make, v.model].filter(Boolean).join(' ')}${v.vin ? ` (VIN: ${v.vin})` : ''}`)
      .join('; ');

    const driverSummary = (document.driverInfo as any[] || [])
      .map((d, i) => `Driver ${i + 1}: ${d.name || 'Unknown'}${d.dob ? ` (DOB: ${d.dob})` : ''}`)
      .join('; ');

    // ==========================================================================
    // Step 5: Create quote record if we have carrier and product line
    // ==========================================================================

    let quoteId: number | undefined;
    let quoteCreated = false;
    let opportunityId: number | undefined;
    let opportunityCreated = false;

    if (!skipQuote && leadId && carrierId && productLineId && document.quotedPremium) {
      // Check for duplicate quotes first
      try {
        const existingQuotes = await azClient.getLeadQuotes(leadId);
        const isDuplicate = existingQuotes.some(q =>
          q.carrierId === carrierId &&
          q.productLineId === productLineId
        );

        if (isDuplicate) {
          console.log(`[Quote Extractor] Skipping duplicate quote for carrier ${carrierId}, product ${productLineId}`);
        } else {
          // Build property address for property quotes
          let propertyAddress: string | undefined;
          if (isPropertyQuote) {
            const propInfo = document.propertyInfo as Record<string, any> | null;
            propertyAddress = propInfo?.address ||
              `${document.customerAddress || ''}, ${document.customerCity || ''}, ${document.customerState || ''} ${document.customerZip || ''}`.trim();
          }

          // Create the quote
          const quoteResult = await azClient.createLeadQuote(leadId, {
            carrierId,
            productLineId,
            premium: Math.round(document.quotedPremium), // Ensure integer
            items: itemsCount,
            effectiveDate: document.effectiveDate
              ? new Date(document.effectiveDate).toISOString().split('T')[0]
              : undefined,
            propertyAddress: propertyAddress || undefined,
          });

          if (quoteResult.success && quoteResult.quote) {
            quoteId = quoteResult.quote.id;
            quoteCreated = true;
            console.log(`[Quote Extractor] Created quote: ${quoteId} with ${itemsCount} item(s)`);
          } else {
            console.warn('[Quote Extractor] Quote creation failed:', quoteResult.error);
            // Continue anyway - we can still add the note
          }
        }
      } catch (e) {
        console.warn('[Quote Extractor] Quote operations failed:', e);
        // Continue anyway - we can still add the note
      }

      // Also create an opportunity if we have vehicle/driver data to track
      // Opportunities can store additional metadata through notes
      if (body.createOpportunity && !opportunityCreated) {
        try {
          const oppResult = await azClient.createLeadOpportunity(leadId, {
            carrierId,
            productLineId,
            premium: Math.round(document.quotedPremium),
            items: itemsCount,
          });

          if (oppResult.success && oppResult.opportunity) {
            opportunityId = oppResult.opportunity.id;
            opportunityCreated = true;
            console.log(`[Quote Extractor] Created opportunity: ${opportunityId}`);
          }
        } catch (e) {
          console.warn('[Quote Extractor] Opportunity creation failed:', e);
        }
      }
    } else if (!skipQuote) {
      // Log why we couldn't create a quote
      const reasons = [];
      if (!carrierId) reasons.push('no carrier ID');
      if (!productLineId) reasons.push('no product line ID');
      if (!document.quotedPremium) reasons.push('no premium');
      console.log(`[Quote Extractor] Skipping quote creation: ${reasons.join(', ')}`);
    }

    // ==========================================================================
    // Step 6: Build and post note
    // ==========================================================================

    const noteLines = [
      "📄 QUOTE EXTRACTED FROM PDF",
      "",
      `Carrier: ${carrierName || "Unknown"}${carrierId ? ` (ID: ${carrierId})` : ''}`,
      `Product: ${productLineName || "Unknown"}${productLineId ? ` (ID: ${productLineId})` : ''}`,
      `Premium: ${document.quotedPremium ? `$${document.quotedPremium.toLocaleString()}` : "N/A"}`,
      `Term: ${document.termMonths ? `${document.termMonths} months` : "N/A"}`,
    ];

    if (document.quoteNumber) {
      noteLines.push(`Quote #: ${document.quoteNumber}`);
    }

    if (document.effectiveDate) {
      noteLines.push(`Effective: ${new Date(document.effectiveDate).toLocaleDateString()}`);
    }

    // Add items count (vehicles/properties)
    if (itemsCount > 1 || isAutoQuote) {
      noteLines.push(`Items: ${itemsCount} ${isAutoQuote ? 'vehicle(s)' : 'item(s)'}`);
    }

    if (quoteCreated && quoteId) {
      noteLines.push("");
      noteLines.push(`✅ Quote record created in AgencyZoom (Quote ID: ${quoteId}, ${itemsCount} item(s))`);
    } else if (!skipQuote && carrierId && productLineId) {
      noteLines.push("");
      noteLines.push("⚠️ Quote record may already exist or could not be created");
    }

    if (opportunityCreated && opportunityId) {
      noteLines.push(`✅ Opportunity created (ID: ${opportunityId})`);
    }

    noteLines.push("");
    noteLines.push("CUSTOMER INFO:");
    noteLines.push(`Name: ${document.customerName || "N/A"}`);

    if (document.customerAddress) {
      noteLines.push(`Address: ${document.customerAddress}`);
      if (document.customerCity || document.customerState || document.customerZip) {
        noteLines.push(`${document.customerCity || ""}, ${document.customerState || ""} ${document.customerZip || ""}`);
      }
    }

    if (document.customerPhone) noteLines.push(`Phone: ${document.customerPhone}`);
    if (document.customerEmail) noteLines.push(`Email: ${document.customerEmail}`);

    // Add coverage details
    if (document.coverageDetails && typeof document.coverageDetails === "object") {
      noteLines.push("");
      noteLines.push("COVERAGE DETAILS:");
      const coverage = document.coverageDetails as Record<string, any>;
      for (const [key, value] of Object.entries(coverage)) {
        if (value && value !== "null" && value !== null) {
          const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
          noteLines.push(`${label}: ${value}`);
        }
      }
    }

    // Add vehicle info
    if (document.vehicleInfo && Array.isArray(document.vehicleInfo) && document.vehicleInfo.length > 0) {
      noteLines.push("");
      noteLines.push("VEHICLES:");
      for (const vehicle of document.vehicleInfo as any[]) {
        const vInfo = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
        if (vInfo) {
          noteLines.push(`- ${vInfo}${vehicle.vin ? ` (VIN: ${vehicle.vin})` : ""}`);
        }
      }
    }

    // Add driver info
    if (document.driverInfo && Array.isArray(document.driverInfo) && document.driverInfo.length > 0) {
      noteLines.push("");
      noteLines.push("DRIVERS:");
      for (const driver of document.driverInfo as any[]) {
        if (driver.name) {
          noteLines.push(`- ${driver.name}${driver.dob ? ` (DOB: ${driver.dob})` : ""}`);
        }
      }
    }

    // Add property info
    if (document.propertyInfo && typeof document.propertyInfo === "object") {
      const prop = document.propertyInfo as Record<string, any>;
      if (prop.address || prop.yearBuilt || prop.squareFeet) {
        noteLines.push("");
        noteLines.push("PROPERTY:");
        if (prop.address) noteLines.push(`Address: ${prop.address}`);
        if (prop.yearBuilt) noteLines.push(`Year Built: ${prop.yearBuilt}`);
        if (prop.squareFeet) noteLines.push(`Sq Ft: ${prop.squareFeet}`);
        if (prop.roofType) noteLines.push(`Roof: ${prop.roofType}`);
      }
    }

    noteLines.push("");
    noteLines.push(`Source: ${document.originalFileName}`);
    noteLines.push(`Extracted: ${new Date().toLocaleString()}`);

    const noteContent = noteLines.join("\n");

    // Post note to lead or customer
    let noteResult;
    if (leadId) {
      noteResult = await azClient.addLeadNote(leadId, noteContent);
    } else if (customerId) {
      noteResult = await azClient.addNote(customerId, noteContent);
    }

    // ==========================================================================
    // Step 7: Update document record
    // ==========================================================================

    await db
      .update(quoteDocuments)
      .set({
        status: "posted",
        azLeadId: leadId?.toString() || null,
        azCustomerId: customerId?.toString() || null,
        azPostedAt: new Date(),
        azPipelineId: parseInt(pipelineId),
        azStageName: body.stageName || null,
        azNoteId: noteResult?.id?.toString() || null,
        updatedAt: new Date(),
      })
      .where(eq(quoteDocuments.id, id));

    // Build detailed message
    let message = "Lead created in AgencyZoom";
    if (quoteCreated) {
      message = `Quote created with ${itemsCount} item(s)`;
      if (opportunityCreated) {
        message += " and opportunity";
      }
    } else if (!skipQuote && carrierId && productLineId) {
      message = "Lead created (quote may already exist)";
    }

    return NextResponse.json({
      success: true,
      message,
      leadId,
      customerId,
      quoteId,
      quoteCreated,
      opportunityId,
      opportunityCreated,
      carrierId,
      productLineId,
      itemsCount,
      vehicleSummary: vehicleSummary || undefined,
      driverSummary: driverSummary || undefined,
      noteId: noteResult?.id,
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Post to AZ error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to post to AgencyZoom", details: error.message },
      { status: 500 }
    );
  }
}
