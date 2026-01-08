// API Route: /api/outlook/test
// Test Outlook email integration

import { NextRequest, NextResponse } from "next/server";
import { outlookClient } from "@/lib/outlook";

export async function GET() {
  // Check configuration status
  const isConfigured = outlookClient.isConfigured();

  return NextResponse.json({
    configured: isConfigured,
    senderEmail: outlookClient.getSenderEmail(),
    requiredEnvVars: {
      OUTLOOK_TENANT_ID: !!process.env.OUTLOOK_TENANT_ID,
      OUTLOOK_CLIENT_ID: !!process.env.OUTLOOK_CLIENT_ID,
      OUTLOOK_CLIENT_SECRET: !!process.env.OUTLOOK_CLIENT_SECRET,
      OUTLOOK_SENDER_EMAIL: !!process.env.OUTLOOK_SENDER_EMAIL,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body } = await request.json();

    if (!to) {
      return NextResponse.json(
        { error: "Missing 'to' email address" },
        { status: 400 }
      );
    }

    // Check if configured
    if (!outlookClient.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: "Outlook not configured",
        missing: {
          OUTLOOK_TENANT_ID: !process.env.OUTLOOK_TENANT_ID,
          OUTLOOK_CLIENT_ID: !process.env.OUTLOOK_CLIENT_ID,
          OUTLOOK_CLIENT_SECRET: !process.env.OUTLOOK_CLIENT_SECRET,
        },
        instructions: "See Azure AD setup instructions in docs",
      }, { status: 500 });
    }

    // Send test email
    const result = await outlookClient.sendEmail({
      to,
      subject: subject || "TCDS Test Email",
      body: body || `This is a test email from TCDS Agency.\n\nSent at: ${new Date().toISOString()}\n\nIf you received this, the Outlook integration is working correctly.`,
      isHtml: false,
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      sentFrom: outlookClient.getSenderEmail(),
      sentTo: to,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
