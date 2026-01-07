// API Route: /api/quote-extractor/email/messages
// List emails with PDF attachments

import { NextRequest, NextResponse } from "next/server";

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  attachments: {
    id: string;
    filename: string;
    size: number;
    contentType: string;
  }[];
  snippet?: string;
  read?: boolean;
}

// GET - List emails with PDF attachments
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "25");
    const unreadOnly = searchParams.get("unread") === "true";

    // Get email configuration
    const emailEndpoint = process.env.QUOTE_EXTRACTOR_EMAIL_ENDPOINT;
    const emailApiKey = process.env.QUOTE_EXTRACTOR_EMAIL_API_KEY;
    const agentMailEndpoint = process.env.AGENTMAIL_ENDPOINT;

    if (!emailEndpoint && !agentMailEndpoint) {
      return NextResponse.json({
        success: false,
        error: "Email integration not configured",
        messages: [],
      }, { status: 400 });
    }

    let messages: EmailMessage[] = [];

    // Try external email API
    if (emailEndpoint && emailApiKey) {
      try {
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          hasPdfAttachment: "true",
          ...(unreadOnly && { unread: "true" }),
        });

        const response = await fetch(`${emailEndpoint}/messages?${queryParams}`, {
          headers: {
            Authorization: `Bearer ${emailApiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          messages = (data.messages || []).map((msg: any) => ({
            id: msg.id,
            from: msg.from || msg.sender,
            subject: msg.subject || "(No subject)",
            date: msg.date || msg.receivedAt,
            snippet: msg.snippet || msg.preview,
            read: msg.read ?? !msg.unread,
            attachments: (msg.attachments || [])
              .filter((att: any) =>
                att.contentType === "application/pdf" ||
                att.filename?.toLowerCase().endsWith(".pdf")
              )
              .map((att: any) => ({
                id: att.id,
                filename: att.filename || att.name,
                size: att.size,
                contentType: att.contentType || "application/pdf",
              })),
          })).filter((msg: EmailMessage) => msg.attachments.length > 0);
        }
      } catch (err) {
        console.error("[Quote Extractor] External email API error:", err);
      }
    }

    // Try AgentMail as fallback
    if (messages.length === 0 && agentMailEndpoint) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const endpoint = agentMailEndpoint.startsWith("http")
          ? agentMailEndpoint
          : new URL(agentMailEndpoint, baseUrl).href;

        const response = await fetch(`${endpoint}/inbox?limit=${limit}`, {
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          messages = (data.messages || data || [])
            .filter((msg: any) =>
              msg.attachments?.some((att: any) =>
                att.contentType === "application/pdf" ||
                att.filename?.toLowerCase().endsWith(".pdf")
              )
            )
            .map((msg: any) => ({
              id: msg.id,
              from: msg.from,
              subject: msg.subject || "(No subject)",
              date: msg.date || msg.receivedAt,
              snippet: msg.snippet,
              read: msg.read,
              attachments: (msg.attachments || [])
                .filter((att: any) =>
                  att.contentType === "application/pdf" ||
                  att.filename?.toLowerCase().endsWith(".pdf")
                )
                .map((att: any) => ({
                  id: att.id,
                  filename: att.filename || att.name,
                  size: att.size || 0,
                  contentType: "application/pdf",
                })),
            }));
        }
      } catch (err) {
        console.error("[Quote Extractor] AgentMail API error:", err);
      }
    }

    // Sort by date descending
    messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      messages: messages.slice(0, limit),
      total: messages.length,
    });
  } catch (error: any) {
    console.error("[Quote Extractor] Email messages error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch email messages", details: error.message },
      { status: 500 }
    );
  }
}
