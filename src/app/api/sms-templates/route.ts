import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { smsTemplates } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

// =============================================================================
// GET /api/sms-templates - List all SMS templates
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const conditions = [eq(smsTemplates.tenantId, tenantId)];
    if (category) {
      conditions.push(eq(smsTemplates.category, category));
    }

    const templates = await db
      .select()
      .from(smsTemplates)
      .where(and(...conditions))
      .orderBy(desc(smsTemplates.usageCount));

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error("Error fetching SMS templates:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/sms-templates - Create new SMS template
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { name, category, content } = body;

    if (!name || !content) {
      return NextResponse.json(
        { success: false, error: "Name and content are required" },
        { status: 400 }
      );
    }

    // Extract variables from content ({{variableName}} format)
    const variableMatches = content.match(/\{\{(\w+)\}\}/g) || [];
    const variables = Array.from(new Set(variableMatches.map((v: string) => v.replace(/[{}]/g, "")))) as string[];

    const [template] = await db
      .insert(smsTemplates)
      .values({
        tenantId,
        name,
        category: category || "general",
        content,
        variables: variables as string[],
      })
      .returning();

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error("Error creating SMS template:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create template" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/sms-templates - Update SMS template
// =============================================================================
export async function PUT(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { id, name, category, content, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined) {
      updateData.content = content;
      const variableMatches = content.match(/\{\{(\w+)\}\}/g) || [];
      updateData.variables = Array.from(new Set(variableMatches.map((v: string) => v.replace(/[{}]/g, "")))) as string[];
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const [template] = await db
      .update(smsTemplates)
      .set(updateData)
      .where(and(eq(smsTemplates.id, id), eq(smsTemplates.tenantId, tenantId)))
      .returning();

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error("Error updating SMS template:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/sms-templates - Delete SMS template
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Template ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(smsTemplates)
      .where(and(eq(smsTemplates.id, id), eq(smsTemplates.tenantId, tenantId)));

    return NextResponse.json({
      success: true,
      message: "Template deleted",
    });
  } catch (error) {
    console.error("Error deleting SMS template:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
