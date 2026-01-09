import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/server";

// =============================================================================
// POST /api/users/create-auth-accounts - Create Supabase Auth accounts for users
// =============================================================================
// NOTE: Temporarily accessible without auth for initial setup
// TODO: Remove this endpoint after initial setup is complete
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Get all users without authId
    const unlinkedUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), isNull(users.authId)));

    if (unlinkedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All users already have auth accounts",
        created: 0,
        results: [],
      });
    }

    const adminClient = createAdminClient();
    const results: { email: string; status: string; tempPassword?: string }[] = [];
    let created = 0;
    let failed = 0;

    for (const user of unlinkedUsers) {
      if (!user.email) {
        results.push({ email: "unknown", status: "skipped_no_email" });
        failed++;
        continue;
      }

      // Generate a temporary password
      const tempPassword = generateTempPassword();

      try {
        // Create the auth account
        const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            first_name: user.firstName,
            last_name: user.lastName,
          },
        });

        if (createError) {
          console.error(`[Create Auth] Error creating auth for ${user.email}:`, createError);
          results.push({ email: user.email, status: `error: ${createError.message}` });
          failed++;
          continue;
        }

        if (!authUser?.user) {
          results.push({ email: user.email, status: "error: no user returned" });
          failed++;
          continue;
        }

        // Update the user record with the authId
        await db
          .update(users)
          .set({ authId: authUser.user.id })
          .where(eq(users.id, user.id));

        results.push({
          email: user.email,
          status: "created",
          tempPassword,
        });
        created++;
        console.log(`[Create Auth] Created auth account for ${user.email}`);
      } catch (error) {
        console.error(`[Create Auth] Exception for ${user.email}:`, error);
        results.push({
          email: user.email,
          status: `exception: ${error instanceof Error ? error.message : "unknown"}`,
        });
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${created} auth accounts, ${failed} failed`,
      created,
      failed,
      total: unlinkedUsers.length,
      results,
    });
  } catch (error) {
    console.error("[Create Auth] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create auth accounts" },
      { status: 500 }
    );
  }
}

// Generate a random temporary password
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const specials = "!@#$%";
  let password = "";

  // 8 random chars
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Add a special char
  password += specials.charAt(Math.floor(Math.random() * specials.length));

  // Add 2 more random chars
  for (let i = 0; i < 2; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}
