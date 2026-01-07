import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// =============================================================================
// GET /api/users/by-extension/[extension] - Lookup user by 3CX extension
// =============================================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ extension: string }> }
) {
  try {
    const { extension } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        role: users.role,
        extension: users.extension,
        directDial: users.directDial,
        cellPhone: users.cellPhone,
        agencyzoomId: users.agencyzoomId,
        agentCode: users.agentCode,
        isAvailable: users.isAvailable,
        currentStatus: users.currentStatus,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.extension, extension),
          eq(users.isActive, true)
        )
      )
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "No user found with this extension" },
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
    console.error("Error fetching user by extension:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
