import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// POST /api/admin/send-password-reset - Send password reset email
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Generate password reset link
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://tcds-triage.vercel.app"}/auth/callback?next=/my-settings`,
      },
    });

    if (error) {
      console.error("[Password Reset] Error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // The link is in data.properties.action_link
    // Supabase will also send an email automatically if email is configured

    return NextResponse.json({
      success: true,
      message: `Password reset link generated for ${email}`,
      // Include the link for manual sharing if needed
      resetLink: data?.properties?.action_link,
    });
  } catch (error) {
    console.error("[Password Reset] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
