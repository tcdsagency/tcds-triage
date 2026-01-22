// API Route: /api/leads/pipeline
// Get leads grouped by pipeline stage for Kanban board

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, users } from "@/db/schema";
import { eq, and, isNull, sql, desc, inArray } from "drizzle-orm";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// Default pipeline configuration (New Leads Pipeline)
const DEFAULT_PIPELINE = {
  id: 87550,
  name: "New Leads Pipeline",
  stages: [
    { id: 386245, name: "New Lead/Data Entry", order: 0 },
    { id: 386246, name: "Contacted/Quoted", order: 1 },
    { id: 386247, name: "Sent to Customer", order: 2 },
    { id: 386248, name: "Sent to Lender", order: 3 },
    { id: 386249, name: "Sold", order: 4 },
  ],
};

interface PipelineLead {
  id: string;
  agencyzoomId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  pipelineStage: string | null;
  pipelineStageId: number | null;
  stageEnteredAt: Date | null;
  quotedPremium: number | null;
  leadSource: string | null;
  producerId: string | null;
  producerName: string | null;
  createdAt: Date;
}

interface StageData {
  id: number;
  name: string;
  order: number;
  leads: PipelineLead[];
  count: number;
  totalPremium: number;
}

// =============================================================================
// GET - Fetch leads grouped by pipeline stage
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get("pipelineId") || DEFAULT_PIPELINE.id.toString();
    const search = searchParams.get("search") || "";
    const producerFilter = searchParams.get("producerId");
    const fetchFromAz = searchParams.get("fetchFromAz") === "true";

    // Try to get pipeline structure from AgencyZoom
    let pipeline = DEFAULT_PIPELINE;
    try {
      const azClient = getAgencyZoomClient();
      const pipelines = await azClient.getLeadPipelines();
      const foundPipeline = pipelines.find((p: any) => p.id.toString() === pipelineId);
      if (foundPipeline && foundPipeline.stages) {
        pipeline = {
          id: foundPipeline.id,
          name: foundPipeline.name,
          stages: foundPipeline.stages.map((s: any, idx: number) => ({
            id: s.id,
            name: s.name,
            order: s.order ?? idx,
          })).sort((a: any, b: any) => a.order - b.order),
        };
      }
    } catch (e) {
      console.warn("[Pipeline] Failed to fetch pipelines from AgencyZoom, using defaults:", e);
    }

    // Fetch leads from local database
    let leads: PipelineLead[] = [];

    // Build the query
    const conditions = [
      eq(customers.tenantId, tenantId),
      eq(customers.isLead, true),
      eq(customers.isArchived, false),
    ];

    if (producerFilter) {
      conditions.push(eq(customers.producerId, producerFilter));
    }

    // Fetch leads with producer info
    const dbLeads = await db
      .select({
        id: customers.id,
        agencyzoomId: customers.agencyzoomId,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phone: customers.phone,
        pipelineStage: customers.pipelineStage,
        pipelineStageId: customers.pipelineStageId,
        stageEnteredAt: customers.stageEnteredAt,
        quotedPremium: customers.quotedPremium,
        leadSource: customers.leadSource,
        producerId: customers.producerId,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.stageEnteredAt), desc(customers.createdAt))
      .limit(500);

    // Get producer names
    const producerIds = [...new Set(dbLeads.filter(l => l.producerId).map(l => l.producerId!))];
    const producerMap = new Map<string, string>();

    if (producerIds.length > 0) {
      const producers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(inArray(users.id, producerIds));

      producers.forEach(p => {
        producerMap.set(p.id, `${p.firstName} ${p.lastName}`);
      });
    }

    // Map leads with producer names
    leads = dbLeads.map(lead => ({
      ...lead,
      producerName: lead.producerId ? producerMap.get(lead.producerId) || null : null,
    }));

    // Apply search filter
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase();
      leads = leads.filter(lead => {
        const fullName = `${lead.firstName} ${lead.lastName}`.toLowerCase();
        const email = (lead.email || "").toLowerCase();
        const phone = (lead.phone || "").replace(/\D/g, "");
        const searchDigits = search.replace(/\D/g, "");

        return (
          fullName.includes(searchLower) ||
          email.includes(searchLower) ||
          (searchDigits.length >= 3 && phone.includes(searchDigits))
        );
      });
    }

    // Optionally fetch fresh data from AgencyZoom
    if (fetchFromAz) {
      try {
        const azClient = getAgencyZoomClient();
        const azLeads = await azClient.getLeads({
          pipelineId: parseInt(pipelineId),
          limit: 200,
        });

        // Merge AZ leads with local data (AZ data takes precedence for stage info)
        const azLeadMap = new Map(azLeads.data.map((l: any) => [l.id.toString(), l]));

        leads = leads.map(lead => {
          if (lead.agencyzoomId && azLeadMap.has(lead.agencyzoomId)) {
            const azLead = azLeadMap.get(lead.agencyzoomId)!;
            return {
              ...lead,
              pipelineStageId: azLead.stageId || lead.pipelineStageId,
              pipelineStage: azLead.stageName || lead.pipelineStage,
            };
          }
          return lead;
        });
      } catch (e) {
        console.warn("[Pipeline] Failed to fetch leads from AgencyZoom:", e);
      }
    }

    // Group leads by stage
    const stageMap = new Map<number, StageData>();

    // Initialize all stages with empty arrays
    pipeline.stages.forEach(stage => {
      stageMap.set(stage.id, {
        ...stage,
        leads: [],
        count: 0,
        totalPremium: 0,
      });
    });

    // Add an "Unassigned" stage for leads without a stage
    const unassignedStage: StageData = {
      id: 0,
      name: "Unassigned",
      order: -1,
      leads: [],
      count: 0,
      totalPremium: 0,
    };

    // Group leads into stages
    leads.forEach(lead => {
      const stageId = lead.pipelineStageId;

      if (stageId && stageMap.has(stageId)) {
        const stage = stageMap.get(stageId)!;
        stage.leads.push(lead);
        stage.count++;
        stage.totalPremium += lead.quotedPremium || 0;
      } else {
        // Try to match by stage name
        const matchedStage = pipeline.stages.find(
          s => s.name.toLowerCase() === (lead.pipelineStage || "").toLowerCase()
        );

        if (matchedStage && stageMap.has(matchedStage.id)) {
          const stage = stageMap.get(matchedStage.id)!;
          stage.leads.push(lead);
          stage.count++;
          stage.totalPremium += lead.quotedPremium || 0;
        } else {
          // Put in unassigned
          unassignedStage.leads.push(lead);
          unassignedStage.count++;
          unassignedStage.totalPremium += lead.quotedPremium || 0;
        }
      }
    });

    // Build final stages array
    const stages = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);

    // Only include unassigned stage if it has leads
    if (unassignedStage.count > 0) {
      stages.unshift(unassignedStage);
    }

    // Get all employees for the agent badge dropdown
    const employees = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        agencyzoomId: users.agencyzoomId,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

    // Generate colors for agents
    const AGENT_COLORS = [
      "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
      "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
    ];

    const employeesWithColors = employees.map((emp, idx) => ({
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      initials: `${emp.firstName[0] || ""}${emp.lastName[0] || ""}`.toUpperCase(),
      color: AGENT_COLORS[idx % AGENT_COLORS.length],
      agencyzoomId: emp.agencyzoomId,
    }));

    return NextResponse.json({
      success: true,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        stages,
      },
      employees: employeesWithColors,
      totalLeads: leads.length,
    });
  } catch (error: any) {
    console.error("[Pipeline] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch pipeline data", details: error.message },
      { status: 500 }
    );
  }
}
