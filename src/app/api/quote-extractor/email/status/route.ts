// API Route: /api/quote-extractor/email/status
// Check email integration configuration status

import { NextRequest, NextResponse } from "next/server";

// GET - Check if email integration is configured
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Check for email configuration
    const emailEndpoint = process.env.QUOTE_EXTRACTOR_EMAIL_ENDPOINT;
    const emailApiKey = process.env.QUOTE_EXTRACTOR_EMAIL_API_KEY;
    const emailAccount = process.env.QUOTE_EXTRACTOR_EMAIL_ACCOUNT;

    // Alternative: Check for AgentMail or IMAP config
    const agentMailEndpoint = process.env.AGENTMAIL_ENDPOINT;
    const imapHost = process.env.QUOTE_EXTRACTOR_IMAP_HOST;

    const hasDirectConfig = !!(emailEndpoint && emailApiKey);
    const hasAgentMail = !!agentMailEndpoint;
    const hasImap = !!imapHost;

    const isConfigured = hasDirectConfig || hasAgentMail || hasImap;

    return NextResponse.json({
      success: true,
      configured: isConfigured,
      provider: hasDirectConfig ? "api" : hasAgentMail ? "agentmail" : hasImap ? "imap" : null,
      account: emailAccount || null,
      message: isConfigured
        ? "Email integration is configured"
        : "Email integration not configured. Set QUOTE_EXTRACTOR_EMAIL_ENDPOINT and QUOTE_EXTRACTOR_EMAIL_API_KEY environment variables.",
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Email status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check email status", details: error.message },
      { status: 500 }
    );
  }
}
