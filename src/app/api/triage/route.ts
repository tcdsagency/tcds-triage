// TCDS-V100-BUILD-2026-01-06-1530 - If you see this in Vercel, correct file is deployed
// API Route: /api/triage/route.ts
// Unified Triage Queue - AI-prioritized items needing attention

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { triageItems, customers, users, calls } from "@/db/schema";
import { eq, and, desc, asc, sql, inArray, gte, lte, count } from "drizzle-orm";

// =============================================================================
// TYPES - Must match database enums in schema.ts
// =============================================================================

// triageStatusEnum: 'pending', 'in_progress', 'completed', 'escalated', 'cancelled'
type TriageStatus = "pending" | "in_progress" | "completed" | "escalated" | "cancelled";

// triagePriorityEnum: 'low', 'medium', 'high', 'urgent'
type TriagePriority = "low" | "medium" | "high" | "urgent";

// triageTypeEnum: 'call', 'quote', 'claim', 'service', 'lead', 'after_hours'
type TriageType = "call" | "quote" | "claim" | "service" | "lead" | "after_hours";

interface CreateTriageRequest {
  type: TriageType;  // 'call', 'quote', 'claim', 'service', 'lead', 'after_hours'
  title: string;
  description?: string;
  customerId?: string;
  callId?: string;
  priority?: TriagePriority;
  dueAt?: string;
  assignToId?: string;
  // Customer context for AI scoring
  customerName?: string;
  customerPhone?: string;
  customerLevel?: string;
  totalPremium?: number;
  isOG?: boolean;
}

// =============================================================================
// AI PRIORITY SCORING
// =============================================================================

function calculateAIPriority(params: {
  type: TriageType;
  customerLevel?: string;
  totalPremium?: number;
  isOG?: boolean;
  callDuration?: number;
  isRepeatCaller?: boolean;
  createdAt?: Date;
}): { score: number; reason: string } {
  let score = 30; // Base score
  const reasons: string[] = [];

  // Customer value factors
  if (params.customerLevel === "AAA") {
    score += 25;
    reasons.push("AAA Premier customer");
  } else if (params.customerLevel === "AA") {
    score += 15;
    reasons.push("AA customer");
  } else if (params.customerLevel === "A") {
    score += 5;
  }

  if (params.isOG) {
    score += 10;
    reasons.push("OG customer (pre-2021)");
  }

  if (params.totalPremium && params.totalPremium > 10000) {
    score += 10;
    reasons.push("High premium ($10K+)");
  } else if (params.totalPremium && params.totalPremium > 5000) {
    score += 5;
  }

  // Type urgency - using schema types: 'call', 'quote', 'claim', 'service', 'lead', 'after_hours'
  if (params.type === "call") {
    score += 15;
    reasons.push("Call-related");
  }
  if (params.type === "claim") {
    score += 20;
    reasons.push("Claim-related");
  }
  if (params.type === "after_hours") {
    score += 10;
    reasons.push("After hours");
  }

  // Call duration (short calls may be missed connections)
  if (params.callDuration !== undefined && params.callDuration < 30) {
    score += 10;
    reasons.push("Short call (<30s)");
  }

  // Repeat caller
  if (params.isRepeatCaller) {
    score += 10;
    reasons.push("Repeat caller");
  }

  // Age factor (older items get priority boost)
  if (params.createdAt) {
    const ageHours = (Date.now() - params.createdAt.getTime()) / (1000 * 60 * 60);
    const ageBonus = Math.min(Math.floor(ageHours * 2), 20);
    if (ageBonus > 0) {
      score += ageBonus;
      reasons.push(`Waiting ${Math.floor(ageHours)}h`);
    }
  }

  return {
    score: Math.min(score, 100),
    reason: reasons.length > 0 ? reasons.join(", ") : "Standard priority"
  };
}

function getPriorityFromScore(score: number): TriagePriority {
  if (score >= 80) return "urgent";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// =============================================================================
// GET - List Triage Items with Stats
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const typeParam = searchParams.get("type");
    const assignedTo = searchParams.get("assignedTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
    const offset = (page - 1) * limit;
    
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Valid enum values from schema
    const validStatuses = ["pending", "in_progress", "completed", "escalated", "cancelled"] as const;
    const validTypes = ["call", "quote", "claim", "service", "lead", "after_hours"] as const;

    // Build filters
    const filters: any[] = [eq(triageItems.tenantId, tenantId)];
    
    if (statusParam && statusParam !== "all" && validStatuses.includes(statusParam as any)) {
      filters.push(eq(triageItems.status, statusParam as typeof validStatuses[number]));
    }
    
    if (typeParam && typeParam !== "all" && validTypes.includes(typeParam as any)) {
      filters.push(eq(triageItems.type, typeParam as typeof validTypes[number]));
    }
    
    if (assignedTo) {
      filters.push(eq(triageItems.assignedToId, assignedTo));
    }

    // Get items with pagination
    const items = await db
      .select({
        id: triageItems.id,
        type: triageItems.type,
        status: triageItems.status,
        priority: triageItems.priority,
        title: triageItems.title,
        description: triageItems.description,
        aiSummary: triageItems.aiSummary,
        aiPriorityScore: triageItems.aiPriorityScore,
        aiPriorityReason: triageItems.aiPriorityReason,
        customerId: triageItems.customerId,
        callId: triageItems.callId,
        assignedToId: triageItems.assignedToId,
        assignedAt: triageItems.assignedAt,
        dueAt: triageItems.dueAt,
        slaBreached: triageItems.slaBreached,
        createdAt: triageItems.createdAt,
        updatedAt: triageItems.updatedAt,
      })
      .from(triageItems)
      .where(and(...filters))
      .orderBy(
        desc(triageItems.aiPriorityScore), // Highest priority first
        asc(triageItems.createdAt) // Then oldest first
      )
      .limit(limit)
      .offset(offset);

    // Get customer info for items
    const customerIds = items.map(i => i.customerId).filter(Boolean) as string[];
    const customersData = customerIds.length > 0
      ? await db
          .select({
            id: customers.id,
            firstName: customers.firstName,
            lastName: customers.lastName,
            phone: customers.phone,
          })
          .from(customers)
          .where(inArray(customers.id, customerIds))
      : [];
    
    const customerMap = new Map(customersData.map(c => [
      c.id, 
      { 
        id: c.id, 
        name: `${c.firstName} ${c.lastName}`.trim(),
        phone: c.phone 
      }
    ]));

    // Get assigned user info
    const assignedIds = items.map(i => i.assignedToId).filter(Boolean) as string[];
    const assignedUsers = assignedIds.length > 0
      ? await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(users.id, assignedIds))
      : [];
    
    const userMap = new Map(assignedUsers.map(u => [
      u.id,
      { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }
    ]));

    // Enrich items with customer and user data
    const enrichedItems = items.map(item => ({
      ...item,
      aiPriorityScore: item.aiPriorityScore ? parseFloat(item.aiPriorityScore) : null,
      customer: item.customerId ? customerMap.get(item.customerId) || null : null,
      assignedTo: item.assignedToId ? userMap.get(item.assignedToId) || null : null,
      ageMinutes: Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 60000),
    }));

    // Get total count for pagination
    const [{ total }] = await db
      .select({ total: count() })
      .from(triageItems)
      .where(and(...filters));

    // Get stats
    const allItems = await db
      .select({
        status: triageItems.status,
        priority: triageItems.priority,
        type: triageItems.type,
        dueAt: triageItems.dueAt,
        slaBreached: triageItems.slaBreached,
        assignedToId: triageItems.assignedToId,
      })
      .from(triageItems)
      .where(eq(triageItems.tenantId, tenantId));

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const stats = {
      byStatus: {
        pending: allItems.filter(i => i.status === "pending").length,
        inProgress: allItems.filter(i => i.status === "in_progress").length,
        escalated: allItems.filter(i => i.status === "escalated").length,
        completed: allItems.filter(i => i.status === "completed").length,
        cancelled: allItems.filter(i => i.status === "cancelled").length,
      },
      byPriority: {
        urgent: allItems.filter(i => i.priority === "urgent").length,
        high: allItems.filter(i => i.priority === "high").length,
        medium: allItems.filter(i => i.priority === "medium").length,
        low: allItems.filter(i => i.priority === "low").length,
      },
      byType: {
        call: allItems.filter(i => i.type === "call").length,
        quote: allItems.filter(i => i.type === "quote").length,
        claim: allItems.filter(i => i.type === "claim").length,
        service: allItems.filter(i => i.type === "service").length,
        lead: allItems.filter(i => i.type === "lead").length,
        after_hours: allItems.filter(i => i.type === "after_hours").length,
      },
      sla: {
        breached: allItems.filter(i => i.slaBreached).length,
        dueSoon: allItems.filter(i => 
          i.dueAt && !i.slaBreached && new Date(i.dueAt) <= oneHourFromNow
        ).length,
        healthy: allItems.filter(i => 
          !i.slaBreached && (!i.dueAt || new Date(i.dueAt) > oneHourFromNow)
        ).length,
      },
      unassigned: allItems.filter(i => !i.assignedToId && i.status === "pending").length,
    };

    return NextResponse.json({
      success: true,
      items: enrichedItems,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Triage list error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "List failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create Triage Item
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CreateTriageRequest = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;
    
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: "Type and title are required" },
        { status: 400 }
      );
    }

    // Calculate AI priority score
    const { score, reason } = calculateAIPriority({
      type: body.type,
      customerLevel: body.customerLevel,
      totalPremium: body.totalPremium,
      isOG: body.isOG,
    });

    const priority = body.priority || getPriorityFromScore(score);

    // Calculate SLA due date (default 4 hours, 1 hour for urgent)
    const now = new Date();
    const slaHours = priority === "urgent" ? 1 : priority === "high" ? 2 : 4;
    const dueAt = body.dueAt ? new Date(body.dueAt) : new Date(now.getTime() + slaHours * 60 * 60 * 1000);

    const [item] = await db
      .insert(triageItems)
      .values({
        tenantId,
        type: body.type,
        status: "pending",
        priority,
        title: body.title,
        description: body.description,
        customerId: body.customerId,
        callId: body.callId,
        assignedToId: body.assignToId,
        assignedAt: body.assignToId ? now : null,
        aiPriorityScore: String(score),
        aiPriorityReason: reason,
        dueAt,
      })
      .returning();

    return NextResponse.json({
      success: true,
      item: {
        ...item,
        aiPriorityScore: score,
      },
    });
  } catch (error) {
    console.error("Triage create error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Create failed" },
      { status: 500 }
    );
  }
}
