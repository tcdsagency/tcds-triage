// API Route: /api/quote-extractor/documents/[id]/post-to-az
// Post extracted quote data to AgencyZoom as a lead

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quoteDocuments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// POST - Create/Update AgencyZoom Lead
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { pipelineId, stageId, agentId, existingLeadId, existingCustomerId } = body;

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

    // Parse customer name
    const nameParts = (document.customerName || "Unknown Customer").split(" ");
    const firstName = nameParts[0] || "Unknown";
    const lastName = nameParts.slice(1).join(" ") || "Customer";

    const azClient = getAgencyZoomClient();
    let leadId = existingLeadId;
    let customerId = existingCustomerId;

    // Create lead if no existing lead provided
    if (!leadId && !customerId) {
      const leadResult = await azClient.createLead({
        firstName,
        lastName,
        email: document.customerEmail || undefined,
        phone: document.customerPhone || undefined,
        pipelineId: parseInt(pipelineId),
        stageId: parseInt(stageId),
        source: "Quote Extractor",
        agentId: agentId ? parseInt(agentId) : undefined,
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
    }

    // Build note content
    const noteLines = [
      "📄 QUOTE EXTRACTED FROM PDF",
      "",
      `Carrier: ${document.carrierName || "Unknown"}`,
      `Quote Type: ${document.quoteType || "Unknown"}`,
      `Premium: ${document.quotedPremium ? `$${document.quotedPremium.toLocaleString()}` : "N/A"}`,
      `Term: ${document.termMonths ? `${document.termMonths} months` : "N/A"}`,
    ];

    if (document.quoteNumber) {
      noteLines.push(`Quote #: ${document.quoteNumber}`);
    }

    if (document.effectiveDate) {
      noteLines.push(`Effective: ${new Date(document.effectiveDate).toLocaleDateString()}`);
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

    // Update document with AZ info
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

    return NextResponse.json({
      success: true,
      message: "Quote posted to AgencyZoom",
      leadId,
      customerId,
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
