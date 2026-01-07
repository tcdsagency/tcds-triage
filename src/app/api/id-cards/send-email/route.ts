// API Route: /api/id-cards/send-email
// Send ID card PDF via Outlook email

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generatedIdCards } from "@/db/schema";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { outlookClient } from "@/lib/outlook";

// Default sender email for ID cards
const SENDER_EMAIL = "agency@tcdsagency.com";

interface SendEmailRequest {
  email: string;
  pdfBase64: string;
  filename: string;
  insuredName: string;
  contactId: string;
  contactType: string;
  policyNumber: string;
  carrier?: string;
  effectiveDate?: string;
  expirationDate?: string;
  vehicleCount?: number;
  vehicles?: Array<{ year: string; make: string; model: string; vin: string }>;
  hawksoftClientNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body: SendEmailRequest = await request.json();

    if (!body.email || !body.pdfBase64 || !body.insuredName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: email, pdfBase64, insuredName" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Build email content
    const subject = `Your Insurance ID Card - ${body.policyNumber}`;
    const emailBody = `
Dear ${body.insuredName},

Please find your insurance ID card attached to this email.

Policy Details:
• Policy Number: ${body.policyNumber}
${body.carrier ? `• Carrier: ${body.carrier}` : ""}
${body.effectiveDate ? `• Effective Date: ${body.effectiveDate}` : ""}
${body.expirationDate ? `• Expiration Date: ${body.expirationDate}` : ""}

Please keep this ID card in your vehicle at all times as proof of insurance.

If you have any questions, please don't hesitate to contact us at (903) 872-7878.

Thank you for your business!

---
TCDS Agency
agency@tcdsagency.com
(903) 872-7878
    `.trim();

    let emailSent = false;
    let sendError = "";
    let messageId = "";

    // Try Outlook/Microsoft Graph first
    if (outlookClient.isConfigured()) {
      const result = await outlookClient.sendEmail({
        to: body.email,
        subject,
        body: emailBody,
        from: SENDER_EMAIL,
        attachments: [
          {
            filename: body.filename || "ID_Card.pdf",
            content: body.pdfBase64,
            contentType: "application/pdf",
          },
        ],
      });

      if (result.success) {
        emailSent = true;
        messageId = result.messageId || "";
      } else {
        sendError = result.error || "Outlook send failed";
      }
    } else {
      // Fallback to legacy email endpoints
      const agentMailEndpoint = process.env.AGENTMAIL_ENDPOINT;
      const emailSendEndpoint = process.env.EMAIL_SEND_ENDPOINT;

      // Try AgentMail
      if (!emailSent && agentMailEndpoint) {
        try {
          const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
          const endpoint = agentMailEndpoint.startsWith("http")
            ? agentMailEndpoint
            : new URL(agentMailEndpoint, baseUrl).href;

          const response = await fetch(`${endpoint}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: [body.email],
              subject,
              text: emailBody,
              attachments: [
                {
                  filename: body.filename || "ID_Card.pdf",
                  content: body.pdfBase64,
                  encoding: "base64",
                  contentType: "application/pdf",
                },
              ],
            }),
          });

          if (response.ok) {
            emailSent = true;
          } else {
            const errData = await response.json().catch(() => ({}));
            sendError = errData.error || `HTTP ${response.status}`;
          }
        } catch (err: any) {
          sendError = err.message;
          console.error("[ID Cards] AgentMail error:", err);
        }
      }

      // Try alternate endpoint
      if (!emailSent && emailSendEndpoint) {
        try {
          const response = await fetch(emailSendEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: body.email,
              subject,
              body: emailBody,
              attachments: [
                {
                  filename: body.filename || "ID_Card.pdf",
                  data: body.pdfBase64,
                  type: "application/pdf",
                },
              ],
            }),
          });

          if (response.ok) {
            emailSent = true;
          }
        } catch (err: any) {
          console.error("[ID Cards] Email endpoint error:", err);
        }
      }
    }

    // Save to history
    if (body.contactId && body.policyNumber) {
      try {
        await db.insert(generatedIdCards).values({
          tenantId,
          contactId: body.contactId,
          contactType: body.contactType || "customer",
          contactName: body.insuredName,
          hawksoftClientNumber: body.hawksoftClientNumber || null,
          policyNumber: body.policyNumber,
          carrier: body.carrier || "Unknown",
          effectiveDate: body.effectiveDate || "",
          expirationDate: body.expirationDate || "",
          vehicleCount: body.vehicleCount || 1,
          vehicles: body.vehicles || null,
          pdfBase64: body.pdfBase64,
          deliveryMethod: "email",
          deliveredTo: body.email,
          deliveredAt: emailSent ? new Date() : null,
        });
      } catch (dbErr) {
        console.error("[ID Cards] Failed to save history:", dbErr);
      }
    }

    // Add note to AgencyZoom
    if (emailSent && body.contactId) {
      try {
        const azClient = getAgencyZoomClient();
        const noteContent = `ID Card emailed to ${body.email}\nPolicy: ${body.policyNumber}\n${body.carrier || ""}\nSent from: ${SENDER_EMAIL}`;

        if (body.contactType === "customer") {
          await azClient.addNote(parseInt(body.contactId), noteContent);
        } else {
          await azClient.addLeadNote(parseInt(body.contactId), noteContent);
        }
      } catch (azErr) {
        console.error("[ID Cards] Failed to add AZ note:", azErr);
      }
    }

    if (!emailSent) {
      return NextResponse.json({
        success: false,
        error: sendError || "Email delivery not configured. Set Outlook credentials or AGENTMAIL_ENDPOINT.",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `ID card sent to ${body.email}`,
      from: SENDER_EMAIL,
      messageId,
    });
  } catch (error: any) {
    console.error("[ID Cards] Send email error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send email", details: error.message },
      { status: 500 }
    );
  }
}
