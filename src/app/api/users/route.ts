import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";

// =============================================================================
// GET /api/users - List all users/agents
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const activeOnly = searchParams.get("active") !== "false";

    // For now, use a hardcoded tenant ID (in production, get from auth)
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    let query = db
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
        skillLevel: users.skillLevel,
        inLeadRotation: users.inLeadRotation,
        isActive: users.isActive,
        lastActiveAt: users.lastActiveAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .$dynamic();

    // Filter by active status
    if (activeOnly) {
      query = query.where(eq(users.isActive, true));
    }

    // Filter by role
    if (role) {
      query = query.where(eq(users.role, role as any));
    }

    const results = await query;

    // Filter by search term in memory (for simplicity)
    let filteredResults = results;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredResults = results.filter(
        (user) =>
          user.firstName?.toLowerCase().includes(searchLower) ||
          user.lastName?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.extension?.includes(search)
      );
    }

    // Map to include computed fields
    const usersWithName = filteredResults.map((user) => ({
      ...user,
      name: `${user.firstName} ${user.lastName}`.trim(),
      initials: `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase(),
    }));

    return NextResponse.json({
      success: true,
      users: usersWithName,
      count: usersWithName.length,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/users - Create new user/agent
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      firstName,
      lastName,
      phone,
      avatarUrl,
      role = "agent",
      extension,
      directDial,
      cellPhone,
      agencyzoomId,
      agentCode,
      inLeadRotation = true,
    } = body;

    // Validation
    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "Email, first name, and last name are required" },
        { status: 400 }
      );
    }

    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Check for duplicate email
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
      .limit(1);

    if (existingEmail.length > 0) {
      return NextResponse.json(
        { success: false, error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Check for duplicate extension if provided
    if (extension) {
      const existingExt = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.extension, extension)))
        .limit(1);

      if (existingExt.length > 0) {
        return NextResponse.json(
          { success: false, error: "This extension is already assigned to another user" },
          { status: 400 }
        );
      }
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        tenantId,
        email,
        firstName,
        lastName,
        phone: phone || null,
        avatarUrl: avatarUrl || null,
        role,
        extension: extension || null,
        directDial: directDial || null,
        cellPhone: cellPhone || null,
        agencyzoomId: agencyzoomId || null,
        agentCode: agentCode || null,
        inLeadRotation,
        isActive: true,
        isAvailable: true,
        currentStatus: "available",
        skillLevel: 1,
      })
      .returning();

    return NextResponse.json({
      success: true,
      user: {
        ...newUser,
        name: `${newUser.firstName} ${newUser.lastName}`.trim(),
        initials: `${newUser.firstName?.[0] || ""}${newUser.lastName?.[0] || ""}`.toUpperCase(),
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create user" },
      { status: 500 }
    );
  }
}
