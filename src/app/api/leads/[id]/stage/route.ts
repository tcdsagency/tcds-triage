// API Route: /api/leads/[id]/stage
// Update lead pipeline stage (local DB + push to AgencyZoom)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

interface StageUpdateRequest {
  stageId: number;
  stageName?: string;
}

// =============================================================================
// PATCH - Update lead's pipeline stage
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: StageUpdateRequest = await request.json();
    const { stageId, stageName } = body;

    if (!stageId) {
      return NextResponse.json({ error: "stageId is required" }, { status: 400 });
    }

    // Get the current lead
    const [lead] = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
        pipelineStageId: customers.pipelineStageId,
        firstName: customers.firstName,
        lastName: customers.lastName,
      })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Update local database
    const [updated] = await db
      .update(customers)
      .set({
        pipelineStageId: stageId,
        pipelineStage: stageName || null,
        stageEnteredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning({
        id: customers.id,
        pipelineStageId: customers.pipelineStageId,
        pipelineStage: customers.pipelineStage,
        stageEnteredAt: customers.stageEnteredAt,
      });

    // Push to AgencyZoom if lead has an agencyzoomId
    let azSyncResult = { success: true, error: null as string | null };

    if (lead.agencyzoomId) {
      try {
        const azClient = getAgencyZoomClient();
        await azClient.updateLead(parseInt(lead.agencyzoomId), { stageId });
        console.log(
          `[Stage Update] Pushed stage ${stageId} to AgencyZoom for lead ${lead.agencyzoomId}`
        );
      } catch (azError: any) {
        console.error(
          `[Stage Update] Failed to push to AgencyZoom for lead ${lead.agencyzoomId}:`,
          azError
        );
        azSyncResult = {
          success: false,
          error: azError.message || "Failed to sync with AgencyZoom",
        };
      }
    }

    return NextResponse.json({
      success: true,
      lead: updated,
      agencyzoomSync: azSyncResult,
      message: azSyncResult.success
        ? "Stage updated successfully"
        : "Stage updated locally, but AgencyZoom sync failed",
    });
  } catch (error: any) {
    console.error("[Stage Update] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update stage", details: error.message },
      { status: 500 }
    );
  }
}
