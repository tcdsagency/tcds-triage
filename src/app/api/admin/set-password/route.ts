import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// POST /api/admin/set-password - Directly set a user's password (admin only)
export async function POST(request: NextRequest) {
  try {
    const { email, password, userId } = await request.json();

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (!email && !userId) {
      return NextResponse.json(
        { success: false, error: "Email or userId is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // If we have email but not userId, look up the user
    let targetUserId = userId;
    if (!targetUserId && email) {
      // List users and find by email
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers();

      if (listError) {
        return NextResponse.json(
          { success: false, error: listError.message },
          { status: 500 }
        );
      }

      const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) {
        return NextResponse.json(
          { success: false, error: `No auth user found with email: ${email}` },
          { status: 404 }
        );
      }
      targetUserId = user.id;
    }

    // Update the user's password
    const { data, error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password,
    });

    if (error) {
      console.error("[Set Password] Error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Password updated for ${data.user.email}`,
      email: data.user.email,
    });
  } catch (error) {
    console.error("[Set Password] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
