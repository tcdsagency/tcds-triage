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

// Default Category & Priority
const DEFAULT_CATEGORY_ID = 115762;  // "Update Me" / default category
const DEFAULT_PRIORITY_ID = 27902;   // Standard priority

// Priority IDs
const PRIORITY_IDS: Record<string, number> = {
  standard: 27902,
  high: 27903,
  urgent: 27904,
};

// Service Request Category IDs (AI-detected categories)
const CATEGORY_IDS: Record<string, number> = {
  wrong_number_hangup: 115762,
  claims_consult: 115766,
  claims_filed: 37333,
  claims_not_filed: 37332,
  claims_payment: 115764,
  pm_vehicle: 115762,      // Default - specific IDs can be added
  pm_driver: 115762,
  pm_coverage: 115762,
  pm_address: 115762,
  pm_mortgagee: 115762,
  billing_question: 115762,
  billing_payment: 115762,
  doc_request: 115762,
  quote_followup: 115762,
  renewal_review: 115762,
  update_me: 115762,
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

  // Request details
  summary: string;
  category?: string;
  priority?: "standard" | "high" | "urgent";

  // Assignment
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

    // Build description with original customer info if using No Match
    let effectiveDescription = body.summary;
    if (useNoMatch) {
      effectiveDescription = `${body.summary}

--- Original ${isLead ? "Lead" : "Customer"} Info ---
Name: ${body.customerName}
${body.customerPhone ? `Phone: ${body.customerPhone}` : ""}
${isLead ? `Lead ID: ${body.customerId}` : `Customer ID: ${body.customerId}`}
${body.leadPipeline ? `Pipeline: ${body.leadPipeline}` : ""}
${body.leadStage ? `Stage: ${body.leadStage}` : ""}`.trim();
    }

    // Get category and priority IDs
    const categoryId = body.category ? (CATEGORY_IDS[body.category] || DEFAULT_CATEGORY_ID) : DEFAULT_CATEGORY_ID;
    const priorityId = body.priority ? (PRIORITY_IDS[body.priority] || DEFAULT_PRIORITY_ID) : DEFAULT_PRIORITY_ID;

    // Build Zapier payload
    const zapierPayload = {
      // Customer identification
      Name: effectiveName,
      Email: effectiveEmail,

      // Ticket content
      Subject: `Service Request - ${new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago" })}`,
      "Service Desc": effectiveDescription,

      // Pipeline routing
      "Pipeline Id": PIPELINE_ID,
      "Stage Id": STAGE_ID,

      // Task properties
      "Due After Days": 1,
      "Category Id": categoryId,
      "Priority Id": priorityId,
      "Csr Id": body.assigneeAgentId,
    };

    console.log("[ServiceRequest] Sending to Zapier:", {
      name: effectiveName,
      email: effectiveEmail,
      assignee: body.assigneeAgentId,
      category: body.category || "default",
      priority: body.priority || "standard",
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

Assigned to CSR ID: ${body.assigneeAgentId}
Priority: ${body.priority || "Standard"}`;

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
// GET - Get service request status (placeholder for future use)
// =============================================================================

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: "Service request API is running",
    endpoints: {
      POST: {
        description: "Create a service request via Zapier webhook",
        body: {
          customerId: "string (required)",
          customerName: "string (required)",
          customerEmail: "string (optional)",
          customerPhone: "string (optional)",
          customerType: "'customer' | 'lead'",
          summary: "string (required)",
          category: "string (optional)",
          priority: "'standard' | 'high' | 'urgent'",
          assigneeAgentId: "number (required)",
          wrapupId: "string (optional)",
        },
      },
    },
  });
}
