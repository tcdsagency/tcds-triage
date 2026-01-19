import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// POST /api/admin/create-auth-user - Create a Supabase auth user and link to DB user
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check if user already exists in Supabase auth
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // User exists, just update password and link to DB
      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        existingUser.id,
        { password }
      );

      if (updateError) {
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        );
      }

      // Link to DB user
      await db
        .update(users)
        .set({ authId: existingUser.id })
        .where(eq(users.email, email));

      return NextResponse.json({
        success: true,
        message: `Auth user already existed. Password updated and linked to DB user.`,
        authId: existingUser.id,
        email,
      });
    }

    // Create new auth user
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (error) {
      console.error("[Create Auth User] Error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Link the auth user to the database user
    const [updatedUser] = await db
      .update(users)
      .set({ authId: data.user.id })
      .where(eq(users.email, email))
      .returning();

    return NextResponse.json({
      success: true,
      message: `Auth user created for ${email}`,
      authId: data.user.id,
      email: data.user.email,
      linkedToDbUser: !!updatedUser,
      dbUserName: updatedUser ? `${updatedUser.firstName} ${updatedUser.lastName}` : null,
    });
  } catch (error) {
    console.error("[Create Auth User] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
