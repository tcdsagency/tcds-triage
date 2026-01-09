import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// =============================================================================
// POST /api/users/[id]/reset-password - Reset user password (admin only)
// =============================================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Verify the requesting user is an admin
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get requesting user's role
    const [requestingUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.authId, currentUser.id)))
      .limit(1);

    if (!requestingUser || !["owner", "admin", "supervisor"].includes(requestingUser.role || "")) {
      return NextResponse.json(
        { success: false, error: "Only owners, admins, and supervisors can reset passwords" },
        { status: 403 }
      );
    }

    // Get the target user
    const [targetUser] = await db
      .select({ authId: users.authId, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (!targetUser.authId) {
      return NextResponse.json(
        { success: false, error: "User does not have an auth account. They may need to be invited first." },
        { status: 400 }
      );
    }

    // Get the new password from request body
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Use admin client to reset password
    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(targetUser.authId, {
      password: newPassword,
    });

    if (error) {
      console.error("[Password Reset] Supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(`[Password Reset] Password reset for user ${targetUser.email} by ${currentUser.email}`);

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${targetUser.firstName} ${targetUser.lastName}`,
    });
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reset password" },
      { status: 500 }
    );
  }
}
