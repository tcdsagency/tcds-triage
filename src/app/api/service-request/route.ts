// API Route: /api/service-request
// Create service requests via Zapier webhook to AgencyZoom Service Center

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { wrapupDrafts } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// CONSTANTS
// =============================================================================

const ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/5343719/uf796g9/";

// Pipeline & Stage IDs for AgencyZoom Service Center
const PIPELINE_ID = 30699;      // Service Center pipeline
const STAGE_ID = 111160;        // Initial "New" stage

// =============================================================================
// SERVICE REQUEST TYPES (AI-detected from transcript)
// =============================================================================

export const SERVICE_REQUEST_TYPES: Record<string, { id: number; name: string }> = {
  // Claims
  wrong_number_hangup: { id: 115762, name: "Wrong Number/Caller Hangup" },
  claims_consult: { id: 115766, name: "Claims: Consult" },
  claims_filed: { id: 37333, name: "Claims: Filed" },
  claims_not_filed: { id: 37332, name: "Claims: Not Filed" },
  claims_payment: { id: 115764, name: "Claims: Payment/Check" },
  claims_status: { id: 115763, name: "Claims: Status Update" },

  // Renewals
  renewal_commercial: { id: 37334, name: "Renewals: Commercial" },
  renewal_es: { id: 37336, name: "Renewals: E&S" },
  renewal_personal: { id: 37335, name: "Renewals: Personal" },

  // Service - Policy Changes
  service_driver: { id: 37337, name: "Service: +/- Driver" },
  service_insured: { id: 37338, name: "Service: +/- Insured" },
  service_lienholder: { id: 82567, name: "Service: +/- Lienholder" },
  service_property: { id: 82569, name: "Service: +/- Property" },
  service_vehicle: { id: 82565, name: "Service: +/- Vehicle" },

  // Service - Billing
  service_billing_changes: { id: 82577, name: "Service: Billing Changes" },
  service_billing_payments: { id: 82578, name: "Service: Billing Payments" },
  service_billing_questions: { id: 82579, name: "Service: Billing Questions" },

  // Service - Documents
  service_coi: { id: 37341, name: "Service: COI" },
  service_id_cards: { id: 82568, name: "Service: ID Cards" },
  service_loss_run: { id: 82572, name: "Service: Loss Run Request" },

  // Service - Other
  service_audit: { id: 82574, name: "Service: Audit" },
  service_carrier_request: { id: 37339, name: "Service: Carrier Request" },
  service_client_cancelling: { id: 37340, name: "Service: Client Cancelling" },
  service_coverage_change: { id: 37342, name: "Service: Coverage Change" },
  service_discount_documents: { id: 82575, name: "Service: Discount Documents" },
  service_eoi_request: { id: 82576, name: "Service: EOI Request" },
  service_inspection: { id: 37343, name: "Service: Inspection" },
  service_mortgagee_billing: { id: 115765, name: "Service: Mortgagee Billing" },
  service_pending_cancellation: { id: 37344, name: "Service: Pending Cancellation" },
  service_question: { id: 37345, name: "Service: Question" },
  service_remarket: { id: 37346, name: "Service: Remarket/Requote" },
  service_underwriting: { id: 82580, name: "Service: Underwriting" },
  service_update_contact: { id: 82566, name: "Service: Update Contact Info" },

  // Fallback
  update_me: { id: 82573, name: "UPDATE ME!" },
};

// =============================================================================
// PRIORITY TYPES
// =============================================================================

export const PRIORITY_TYPES: Record<string, { id: number; name: string }> = {
  standard: { id: 27902, name: "Standard" },
  urgent: { id: 27900, name: "Urgent!" },
  "2hour": { id: 27901, name: "2 Hour" },
};

// Default values
const DEFAULT_CATEGORY_ID = 82573;   // "UPDATE ME!" as fallback
const DEFAULT_PRIORITY_ID = 27902;   // Standard priority

// =============================================================================
// AGENT IDS (AgencyZoom CSR IDs)
// =============================================================================

export const AGENT_IDS: Record<string, number> = {
  "paulo.gacula": 132766,
  "lee.tidwell": 94007,
  "todd.conn": 94004,
  "stephanie.goodman": 159477,
  "angie.sousa": 94008,
  "blair.lee": 94006,
  "montrice.lemaster": 94005,
  "ai.agent": 114877,
};

// No Customer Match fallback
const NO_MATCH_CUSTOMER = {
  id: "22138921",
  email: "4e80kxy3@robot.zapier.com",
  name: "No Customer Match",
};

// =============================================================================
// TYPES
// =============================================================================

interface ServiceRequestBody {
  // Customer info
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerType: "customer" | "lead";

  // Request details - AI-detected or specified
  summary: string;
  serviceRequestTypeId?: number;      // AI-detected category ID
  serviceRequestTypeName?: string;    // AI-detected category name (used as Subject)
  priorityId?: number;                // AI-detected priority ID
  policyNumbers?: string[];           // AI-extracted policy numbers

  // Legacy fields (for backwards compatibility)
  category?: string;
  priority?: "standard" | "high" | "urgent" | "2hour";

  // Assignment - USER SELECTED
  assigneeAgentId: number;

  // Optional - for updating wrapup records
  wrapupId?: string;

  // Lead details (if lead)
  leadPipeline?: string;
  leadStage?: string;
}

// =============================================================================
// POST - Create Service Request via Zapier
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: ServiceRequestBody = await request.json();

    // Validation
    if (!body.customerId) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }
    if (!body.summary) {
      return NextResponse.json({ error: "Summary is required" }, { status: 400 });
    }
    if (!body.assigneeAgentId) {
      return NextResponse.json({ error: "Assignee agent ID is required" }, { status: 400 });
    }

    // Determine if we need to use No Match fallback
    const hasEmail = Boolean(body.customerEmail);
    const isLead = body.customerType === "lead";

    // Leads and customers without email use No Match placeholder
    const useNoMatch = !hasEmail || isLead;

    const effectiveEmail = useNoMatch ? NO_MATCH_CUSTOMER.email : body.customerEmail;
    const effectiveName = useNoMatch ? NO_MATCH_CUSTOMER.name : body.customerName;

    // Build description with policy numbers and original customer info if using No Match
    let effectiveDescription = body.summary;

    // Add policy numbers if provided
    if (body.policyNumbers && body.policyNumbers.length > 0) {
      effectiveDescription += `\n\nPolicy Numbers: ${body.policyNumbers.join(", ")}`;
    }

    // Add original customer/lead info if using No Match
    if (useNoMatch) {
      effectiveDescription += `

--- ${isLead ? "Lead" : "Caller"} Information ---
Name: ${body.customerName}
${body.customerPhone ? `Phone: ${body.customerPhone}` : ""}
${body.customerEmail ? `Email: ${body.customerEmail}` : "Email: N/A"}
${isLead ? `Lead ID: ${body.customerId}` : ""}
${body.leadPipeline ? `Pipeline: ${body.leadPipeline}` : ""}
${body.leadStage ? `Stage: ${body.leadStage}` : ""}`.trim();
    }

    // Determine category ID (prefer new fields, fall back to legacy)
    let categoryId = DEFAULT_CATEGORY_ID;
    if (body.serviceRequestTypeId) {
      categoryId = body.serviceRequestTypeId;
    } else if (body.category && SERVICE_REQUEST_TYPES[body.category]) {
      categoryId = SERVICE_REQUEST_TYPES[body.category].id;
    }

    // Determine priority ID (prefer new fields, fall back to legacy)
    let priorityId = DEFAULT_PRIORITY_ID;
    if (body.priorityId) {
      priorityId = body.priorityId;
    } else if (body.priority && PRIORITY_TYPES[body.priority]) {
      priorityId = PRIORITY_TYPES[body.priority].id;
    }

    // Determine Subject (use AI-detected type name or fallback)
    const subject = body.serviceRequestTypeName ||
                    (body.category && SERVICE_REQUEST_TYPES[body.category]?.name) ||
                    `Service Request - ${new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" })}`;

    // Build Zapier payload matching exact AgencyZoom field names
    const zapierPayload = {
      // Customer identification
      Name: effectiveName,
      Email: effectiveEmail,

      // Ticket content
      Subject: subject,                    // AI-detected type name
      "Service Desc": effectiveDescription,

      // Pipeline routing (hardcoded)
      "Pipeline Id": PIPELINE_ID,          // Service Center: 30699
      "Stage Id": STAGE_ID,                // New: 111160
      "Due After Days": 1,                 // Due tomorrow

      // Task properties
      "Category Id": categoryId,           // AI-detected or default
      "Priority Id": priorityId,           // AI-detected or default
      "Csr Id": body.assigneeAgentId,      // USER SELECTED
    };

    console.log("[ServiceRequest] Sending to Zapier:", {
      name: effectiveName,
      email: effectiveEmail,
      subject,
      assignee: body.assigneeAgentId,
      categoryId,
      priorityId,
      useNoMatch,
    });

    // Send to Zapier webhook
    const zapierResponse = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(zapierPayload),
    });

    if (!zapierResponse.ok) {
      const errorText = await zapierResponse.text();
      console.error("[ServiceRequest] Zapier webhook error:", zapierResponse.status, errorText);
      return NextResponse.json(
        { error: `Zapier webhook error: ${zapierResponse.status}` },
        { status: 500 }
      );
    }

    const zapierResult = await zapierResponse.json();
    const ticketId = zapierResult.id || `zapier-${Date.now()}`;

    console.log("[ServiceRequest] Zapier response:", zapierResult);

    // Post companion note to AgencyZoom (if not using No Match)
    let noteId: string | null = null;
    if (!useNoMatch && body.customerEmail) {
      try {
        const noteContent = `🎫 Service Request Created - ${new Date().toLocaleString("en-US", {
          timeZone: "America/Chicago",
        })}

${body.summary}

Type: ${subject}
Assigned to CSR ID: ${body.assigneeAgentId}
Priority: ${Object.entries(PRIORITY_TYPES).find(([_, v]) => v.id === priorityId)?.[1]?.name || "Standard"}`;

        const noteResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/agencyzoom/contacts/${body.customerId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: noteContent,
            contactType: body.customerType,
          }),
        });

        if (noteResponse.ok) {
          const noteData = await noteResponse.json();
          noteId = noteData.noteId || noteData.id;
        }
      } catch (noteError) {
        console.error("[ServiceRequest] Error posting companion note:", noteError);
        // Don't fail the request if note posting fails
      }
    }

    // Update wrapup record if provided
    if (body.wrapupId) {
      try {
        await db
          .update(wrapupDrafts)
          .set({
            status: "completed",
            outcome: "ticket",
            agencyzoomNoteId: noteId,
            agencyzoomTicketId: ticketId,
            completedAt: new Date(),
          })
          .where(eq(wrapupDrafts.id, body.wrapupId));
      } catch (dbError) {
        console.error("[ServiceRequest] Error updating wrapup:", dbError);
        // Don't fail the request if wrapup update fails
      }
    }

    return NextResponse.json({
      success: true,
      ticketId,
      noteId,
      message: "Service request created successfully",
      zapierResponse: zapierResult,
    });
  } catch (error) {
    console.error("[ServiceRequest] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create service request" },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Get service request configuration
// =============================================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Service request API is running",
    config: {
      pipelineId: PIPELINE_ID,
      stageId: STAGE_ID,
      serviceRequestTypes: SERVICE_REQUEST_TYPES,
      priorityTypes: PRIORITY_TYPES,
      agentIds: AGENT_IDS,
      noMatchCustomer: NO_MATCH_CUSTOMER,
    },
    endpoints: {
      POST: {
        description: "Create a service request via Zapier webhook",
        requiredFields: {
          customerId: "string - AgencyZoom customer/lead ID",
          customerName: "string - Customer display name",
          summary: "string - Call summary (editable by user)",
          assigneeAgentId: "number - USER SELECTED from agent dropdown",
        },
        autoFields: {
          serviceRequestTypeId: "number - AI-detected category ID",
          serviceRequestTypeName: "string - AI-detected category name (used as Subject)",
          priorityId: "number - AI-detected priority ID",
          policyNumbers: "string[] - AI-extracted policy numbers",
        },
        optionalFields: {
          customerEmail: "string",
          customerPhone: "string",
          customerType: "'customer' | 'lead'",
          wrapupId: "string - ID to update wrapup record",
        },
      },
    },
  });
}
