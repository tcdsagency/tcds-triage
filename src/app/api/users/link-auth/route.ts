import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// =============================================================================
// POST /api/users/link-auth - Link users to their Supabase Auth accounts
// =============================================================================
// NOTE: Temporarily accessible without auth for initial setup
// TODO: Re-enable auth check after initial linking is complete
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
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), isNull(users.authId)));

    if (unlinkedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All users are already linked",
        linked: 0,
        notFound: 0,
      });
    }

    // Use admin client to list auth users
    const adminClient = createAdminClient();
    const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error("[Link Auth] Error listing auth users:", listError);
      return NextResponse.json(
        { success: false, error: "Failed to list auth users" },
        { status: 500 }
      );
    }

    // Create email -> authId map (case insensitive)
    const authMap = new Map<string, string>();
    for (const au of authUsers.users) {
      if (au.email) {
        authMap.set(au.email.toLowerCase(), au.id);
      }
    }

    let linked = 0;
    let notFound = 0;
    const results: { email: string; status: string }[] = [];

    for (const user of unlinkedUsers) {
      if (!user.email) {
        results.push({ email: "unknown", status: "no_email" });
        notFound++;
        continue;
      }

      const authId = authMap.get(user.email.toLowerCase());

      if (authId) {
        // Update user with authId
        await db
          .update(users)
          .set({ authId })
          .where(eq(users.id, user.id));

        results.push({ email: user.email, status: "linked" });
        linked++;
        console.log(`[Link Auth] Linked ${user.email} to auth account ${authId}`);
      } else {
        results.push({ email: user.email, status: "not_found_in_auth" });
        notFound++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Linked ${linked} users, ${notFound} not found in Supabase Auth`,
      linked,
      notFound,
      total: unlinkedUsers.length,
      results,
    });
  } catch (error) {
    console.error("[Link Auth] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to link auth accounts" },
      { status: 500 }
    );
  }
}
