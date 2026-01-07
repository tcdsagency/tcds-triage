import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// GET /api/users/[id] - Get single user by ID
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        name: `${user.firstName} ${user.lastName}`.trim(),
        initials: `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase(),
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/users/[id] - Update user
// =============================================================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Check user exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)))
      .limit(1);

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check for duplicate email if changing
    if (body.email) {
      const existingEmail = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.email, body.email)
        ))
        .limit(1);

      if (existingEmail.length > 0 && existingEmail[0].id !== id) {
        return NextResponse.json(
          { success: false, error: "A user with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate extension if changing
    if (body.extension) {
      const existingExt = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.extension, body.extension)
        ))
        .limit(1);

      if (existingExt.length > 0 && existingExt[0].id !== id) {
        return NextResponse.json(
          { success: false, error: "This extension is already assigned to another user" },
          { status: 400 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    const allowedFields = [
      "email", "firstName", "lastName", "phone", "avatarUrl",
      "role", "extension", "directDial", "cellPhone",
      "agencyzoomId", "agentCode", "isAvailable", "currentStatus",
      "skillLevel", "inLeadRotation", "isActive", "permissions",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)))
      .returning();

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
        initials: `${updatedUser.firstName?.[0] || ""}${updatedUser.lastName?.[0] || ""}`.toUpperCase(),
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/users/[id] - Soft delete user (set isActive = false)
// =============================================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Check user exists
    const [existingUser] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)))
      .limit(1);

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Soft delete - set isActive to false
    await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)));

    return NextResponse.json({
      success: true,
      message: `User ${existingUser.firstName} ${existingUser.lastName} has been deactivated`,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
