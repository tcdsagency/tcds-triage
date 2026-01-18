// API Route: /api/quote-extractor/pipelines
// Get AgencyZoom pipelines for posting quotes

import { NextRequest, NextResponse } from "next/server";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// GET - Get available pipelines from AgencyZoom
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const azClient = getAgencyZoomClient();
    // Use lead pipelines for quote extraction workflow
    const pipelinesList = await azClient.getLeadPipelines();

    if (!pipelinesList || pipelinesList.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No pipelines found in AgencyZoom",
      }, { status: 404 });
    }

    // Format pipelines with their stages
    const pipelines = pipelinesList.map((pipeline: any) => ({
      id: pipeline.id,
      name: pipeline.name,
      type: pipeline.type || "sales",
      stages: (pipeline.stages || []).map((stage: any) => ({
        id: stage.id,
        name: stage.name,
        order: stage.order || stage.sortOrder || 0,
      })).sort((a: any, b: any) => a.order - b.order),
    }));

    // Sort pipelines by name
    pipelines.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      pipelines,
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Pipelines error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get pipelines", details: error.message },
      { status: 500 }
    );
  }
}
