// API Route: /api/auth/me
// Get current logged-in user info

import { NextResponse } from "next/server";
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
        extension: users.extension,
        role: users.role,
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
