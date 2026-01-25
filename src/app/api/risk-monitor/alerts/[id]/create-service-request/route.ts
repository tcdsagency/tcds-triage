// API Route: /api/risk-monitor/alerts/[id]/create-service-request
// Create a service request in AgencyZoom for a risk monitor alert

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { riskMonitorAlerts, riskMonitorPolicies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// POST - Create a service request for an alert
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { id: alertId } = await params;

    // Get the alert with its policy
    const [result] = await db
      .select({
        alert: riskMonitorAlerts,
        policy: riskMonitorPolicies,
      })
      .from(riskMonitorAlerts)
      .leftJoin(riskMonitorPolicies, eq(riskMonitorAlerts.policyId, riskMonitorPolicies.id))
      .where(
        and(
          eq(riskMonitorAlerts.id, alertId),
          eq(riskMonitorAlerts.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!result) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const { alert, policy } = result;

    if (!policy) {
      return NextResponse.json({ error: "Policy not found for this alert" }, { status: 404 });
    }

    if (!policy.azContactId) {
      return NextResponse.json(
        { error: "No AgencyZoom customer ID linked to this policy" },
        { status: 400 }
      );
    }

    // Get AgencyZoom client
    const azClient = getAgencyZoomClient();

    // Get pipelines to find the appropriate one for risk monitor alerts
    const pipelines = await azClient.getServiceTicketPipelines();

    // Find a suitable pipeline - look for "Risk", "Property", or use first available
    let targetPipeline = pipelines.find(
      (p: any) => p.name?.toLowerCase().includes('risk') ||
                   p.name?.toLowerCase().includes('property') ||
                   p.name?.toLowerCase().includes('listing')
    );

    if (!targetPipeline && pipelines.length > 0) {
      targetPipeline = pipelines[0];
    }

    if (!targetPipeline) {
      return NextResponse.json(
        { error: "No service ticket pipeline available in AgencyZoom" },
        { status: 400 }
      );
    }

    // Get the first stage of the pipeline
    const stages = targetPipeline.stages || [];
    const firstStage = stages[0];

    if (!firstStage) {
      return NextResponse.json(
        { error: "No stages found in the service ticket pipeline" },
        { status: 400 }
      );
    }

    // Build the service ticket
    const address = [
      policy.addressLine1,
      policy.city,
      policy.state,
      policy.zipCode,
    ]
      .filter(Boolean)
      .join(", ");

    const statusLabel = policy.currentStatus === "active" ? "Listed For Sale" :
                        policy.currentStatus === "pending" ? "Sale Pending" :
                        policy.currentStatus === "sold" ? "Recently Sold" :
                        policy.currentStatus;

    const listingPriceFormatted = policy.listingPrice
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
        }).format(policy.listingPrice)
      : "N/A";

    const subject = `Property Alert: ${statusLabel} - ${policy.addressLine1 || address}`;

    const description = `
Property Status Alert from Risk Monitor

Customer: ${policy.contactName || "Unknown"}
Address: ${address}
Status: ${statusLabel}
Listing Price: ${listingPriceFormatted}
Policy Number: ${policy.policyNumber || "N/A"}

Alert Details:
${alert.title || "Property listing status change detected"}
${alert.description || ""}

Detected: ${new Date(alert.createdAt).toLocaleString()}

Action Required:
- Contact customer to discuss coverage needs
- Review policy for potential updates
- Confirm if customer is moving/selling

[Created from Risk Monitor Alert]
    `.trim();

    // Create the service ticket
    const ticketResult = await azClient.createServiceTicket({
      subject,
      description,
      customerId: parseInt(policy.azContactId),
      pipelineId: targetPipeline.id,
      stageId: firstStage.id,
      priorityId: alert.priority === "1" ? 1 : alert.priority === "2" ? 2 : 3,
    });

    if (!ticketResult.success) {
      return NextResponse.json(
        { error: "Failed to create service ticket in AgencyZoom" },
        { status: 500 }
      );
    }

    // Update the alert to mark it as in_progress and link the service ticket
    await db
      .update(riskMonitorAlerts)
      .set({
        status: "in_progress",
        serviceTicketId: ticketResult.serviceTicketId?.toString() || null,
        updatedAt: new Date(),
      })
      .where(eq(riskMonitorAlerts.id, alertId));

    return NextResponse.json({
      success: true,
      serviceTicketId: ticketResult.serviceTicketId,
      message: `Service request created in AgencyZoom (Ticket #${ticketResult.serviceTicketId})`,
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error creating service request:", error);
    return NextResponse.json(
      { error: "Failed to create service request", details: error.message },
      { status: 500 }
    );
  }
}
