// API Route: /api/triage/[id]/route.ts
// Individual triage item operations: get, update, claim, complete, escalate

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { triageItems, customers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// GET - Get single triage item with full details
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [item] = await db
      .select()
      .from(triageItems)
      .where(and(eq(triageItems.id, id), eq(triageItems.tenantId, tenantId)))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Get customer details if linked
    let customer = null;
    if (item.customerId) {
      const [c] = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          phone: customers.phone,
          email: customers.email,
          hawksoftClientCode: customers.hawksoftClientCode,
          agencyzoomId: customers.agencyzoomId,
        })
        .from(customers)
        .where(eq(customers.id, item.customerId))
        .limit(1);
      customer = c ? {
        ...c,
        name: `${c.firstName} ${c.lastName}`.trim(),
      } : null;
    }

    // Get assigned user details
    let assignedTo = null;
    if (item.assignedToId) {
      const [u] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, item.assignedToId))
        .limit(1);
      assignedTo = u ? {
        ...u,
        name: `${u.firstName} ${u.lastName}`.trim(),
      } : null;
    }

    return NextResponse.json({
      success: true,
      item: {
        ...item,
        aiPriorityScore: item.aiPriorityScore ? parseFloat(item.aiPriorityScore) : null,
        customer,
        assignedTo,
      },
    });
  } catch (error) {
    console.error("Triage get error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Fetch failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update triage item (status, priority, notes, assignment)
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Verify item exists
    const [existing] = await db
      .select({ id: triageItems.id })
      .from(triageItems)
      .where(and(eq(triageItems.id, id), eq(triageItems.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.status) updates.status = body.status;
    if (body.priority) updates.priority = body.priority;
    if (body.description !== undefined) updates.description = body.description;
    if (body.dueAt) updates.dueAt = new Date(body.dueAt);

    // Handle assignment
    if (body.assignToId !== undefined) {
      updates.assignedToId = body.assignToId || null;
      updates.assignedAt = body.assignToId ? new Date() : null;
    }

    const [updated] = await db
      .update(triageItems)
      .set(updates)
      .where(eq(triageItems.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      item: {
        ...updated,
        aiPriorityScore: updated.aiPriorityScore ? parseFloat(updated.aiPriorityScore) : null,
      },
    });
  } catch (error) {
    console.error("Triage update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Actions: claim, complete, escalate
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action as "claim" | "complete" | "escalate" | "unclaim";
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Verify item exists
    const [existing] = await db
      .select()
      .from(triageItems)
      .where(and(eq(triageItems.id, id), eq(triageItems.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    let updates: Record<string, any> = { updatedAt: new Date() };

    switch (action) {
      // ===== CLAIM - Agent takes ownership =====
      case "claim": {
        if (!body.userId) {
          return NextResponse.json({ error: "userId required for claim" }, { status: 400 });
        }
        updates = {
          ...updates,
          assignedToId: body.userId,
          assignedAt: new Date(),
          status: "in_progress",
        };
        break;
      }

      // ===== UNCLAIM - Release ownership =====
      case "unclaim": {
        updates = {
          ...updates,
          assignedToId: null,
          assignedAt: null,
          status: "pending",
        };
        break;
      }

      // ===== COMPLETE - Resolve the item =====
      case "complete": {
        if (!body.resolution) {
          return NextResponse.json({ error: "resolution required for complete" }, { status: 400 });
        }
        updates = {
          ...updates,
          status: "completed",
          resolution: body.resolution,
          resolvedAt: new Date(),
          resolvedById: body.userId || existing.assignedToId,
        };
        break;
      }

      // ===== ESCALATE - Send to producer/supervisor =====
      case "escalate": {
        if (!body.escalateToId) {
          return NextResponse.json({ error: "escalateToId required for escalate" }, { status: 400 });
        }
        
        // Record escalation details
        const escalationNote = body.reason 
          ? `Escalated: ${body.reason}`
          : "Escalated to producer";
        
        updates = {
          ...updates,
          status: "escalated",
          assignedToId: body.escalateToId,
          assignedAt: new Date(),
          // Append escalation to description
          description: existing.description 
            ? `${existing.description}\n\n[${new Date().toLocaleString()}] ${escalationNote}`
            : escalationNote,
          // Boost priority on escalation
          priority: existing.priority === "low" ? "medium" 
                  : existing.priority === "medium" ? "high" 
                  : "urgent",
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const [updated] = await db
      .update(triageItems)
      .set(updates)
      .where(eq(triageItems.id, id))
      .returning();

    // Get user info for response
    let assignedTo = null;
    if (updated.assignedToId) {
      const [u] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, updated.assignedToId))
        .limit(1);
      assignedTo = u ? { id: u.id, name: `${u.firstName} ${u.lastName}`.trim() } : null;
    }

    return NextResponse.json({
      success: true,
      action,
      item: {
        ...updated,
        aiPriorityScore: updated.aiPriorityScore ? parseFloat(updated.aiPriorityScore) : null,
        assignedTo,
      },
    });
  } catch (error) {
    console.error("Triage action error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Remove triage item (admin only)
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const [deleted] = await db
      .delete(triageItems)
      .where(and(eq(triageItems.id, id), eq(triageItems.tenantId, tenantId)))
      .returning({ id: triageItems.id });

    if (!deleted) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deleted: true,
    });
  } catch (error) {
    console.error("Triage delete error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
