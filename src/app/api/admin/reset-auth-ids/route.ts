import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// POST /api/admin/reset-auth-ids - Reset authId for all users to allow recreation
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Clear authId for all users in this tenant using raw SQL
    await db.execute(
      sql`UPDATE users SET auth_id = NULL WHERE tenant_id = ${tenantId}`
    );

    return NextResponse.json({
      success: true,
      message: "Auth IDs reset for all users. Now call POST /api/users/create-auth-accounts to recreate them.",
    });
  } catch (error) {
    console.error("[Reset Auth IDs] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
