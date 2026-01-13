// API Route: /api/auth/me
// Get and update current logged-in user info

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Look up user in our database
    const [dbUser] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        extension: users.extension,
        directDial: users.directDial,
        currentStatus: users.currentStatus,
        isAvailable: users.isAvailable,
        role: users.role,
        avatarUrl: users.avatarUrl,
        featurePermissions: users.featurePermissions,
      })
      .from(users)
      .where(eq(users.email, authUser.email || ""))
      .limit(1);

    return NextResponse.json({
      success: true,
      user: dbUser || {
        id: authUser.id,
        email: authUser.email,
        firstName: authUser.email?.split("@")[0],
        lastName: null,
      },
    });
  } catch (error) {
    console.error("[Auth Me] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get user" },
      { status: 500 }
    );
  }
}

// Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, phone, extension, directDial, avatarUrl } = body;

    // Find the user by email
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, authUser.email || ""))
      .limit(1);

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user profile
    const [updated] = await db
      .update(users)
      .set({
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(extension !== undefined && { extension }),
        ...(directDial !== undefined && { directDial }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      })
      .where(eq(users.id, existingUser.id))
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        extension: users.extension,
        directDial: users.directDial,
        currentStatus: users.currentStatus,
        isAvailable: users.isAvailable,
        role: users.role,
        avatarUrl: users.avatarUrl,
      });

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (error) {
    console.error("[Auth Me Update] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update user" },
      { status: 500 }
    );
  }
}
