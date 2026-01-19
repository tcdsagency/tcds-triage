// API Route: /api/quote-extractor/pipelines
// Get AgencyZoom pipelines for posting quotes

import { NextRequest, NextResponse } from "next/server";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// Default pipeline configuration for TCDS
// These are known pipeline/stage IDs from AgencyZoom
const DEFAULT_PIPELINES = [
  {
    id: 87550,
    name: "New Leads Pipeline",
    type: "sales",
    stages: [
      { id: 379364, name: "New Lead/Data Entry", order: 0 },
      { id: 379365, name: "Quoted", order: 1 },
      { id: 379366, name: "Presented", order: 2 },
      { id: 379367, name: "Sold/Lost", order: 3 },
    ],
  },
];

// GET - Get available pipelines from AgencyZoom
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Try to get pipelines from AgencyZoom API
    let pipelinesList: any[] = [];
    try {
      const azClient = getAgencyZoomClient();
      pipelinesList = await azClient.getLeadPipelines();
      console.log("[Quote Extractor] Pipelines from API:", JSON.stringify(pipelinesList, null, 2));
    } catch (apiError: any) {
      console.warn("[Quote Extractor] API pipeline fetch failed, using defaults:", apiError.message);
    }

    // If API returned no pipelines, use defaults
    if (!pipelinesList || pipelinesList.length === 0) {
      console.log("[Quote Extractor] Using default pipelines");
      return NextResponse.json({
        success: true,
        pipelines: DEFAULT_PIPELINES,
        source: "defaults",
      });
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
      source: "api",
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Pipelines error:", error);
    // Even on error, return defaults so UI works
    return NextResponse.json({
      success: true,
      pipelines: DEFAULT_PIPELINES,
      source: "defaults",
      warning: error.message,
    });
  }
}
