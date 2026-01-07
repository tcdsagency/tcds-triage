// API Route: /api/id-cards/send-sms
// Send ID card PDF via SMS (upload to storage, send link)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generatedIdCards } from "@/db/schema";
import { twilioClient } from "@/lib/twilio";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

interface SendSMSRequest {
  phone: string;
  pdfBase64: string;
  insuredName: string;
  contactId: string;
  contactType: string;
  policyNumber: string;
  carrier?: string;
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

    const body: SendSMSRequest = await request.json();

    if (!body.phone || !body.pdfBase64 || !body.insuredName) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: phone, pdfBase64, insuredName" },
        { status: 400 }
      );
    }

    // Check if Twilio is configured
    if (!twilioClient.isConfigured()) {
      return NextResponse.json({
        success: false,
        error: "SMS delivery not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.",
      }, { status: 500 });
    }

    // Upload PDF to storage and get a public URL
    let pdfUrl = "";
    const storageEndpoint = process.env.STORAGE_UPLOAD_ENDPOINT;
    const storagePublicUrl = process.env.STORAGE_PUBLIC_URL;

    if (storageEndpoint) {
      try {
        const filename = `id_cards/${Date.now()}_${body.policyNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

        const response = await fetch(storageEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            data: body.pdfBase64,
            contentType: "application/pdf",
          }),
        });

        if (response.ok) {
          const result = await response.json();
          pdfUrl = result.url || (storagePublicUrl ? `${storagePublicUrl}/${filename}` : "");
        }
      } catch (err) {
        console.error("[ID Cards] Storage upload error:", err);
      }
    }

    // If no storage, try using a data URL shortener or direct link service
    if (!pdfUrl) {
      // Fallback: create a temporary download endpoint
      // For now, we'll inform the user that storage isn't configured
      return NextResponse.json({
        success: false,
        error: "PDF storage not configured. Set STORAGE_UPLOAD_ENDPOINT to enable SMS delivery with PDF link.",
      }, { status: 500 });
    }

    // Send SMS with link
    const message = `Your insurance ID card is ready! Policy: ${body.policyNumber}. Download: ${pdfUrl}`;

    const smsResult = await twilioClient.sendSMS({
      to: body.phone,
      message,
    });

    if (!smsResult.success) {
      return NextResponse.json({
        success: false,
        error: smsResult.error || "Failed to send SMS",
      }, { status: 500 });
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
          effectiveDate: "",
          expirationDate: body.expirationDate || "",
          vehicleCount: body.vehicleCount || 1,
          vehicles: body.vehicles || null,
          pdfBase64: body.pdfBase64,
          deliveryMethod: "sms",
          deliveredTo: body.phone,
          deliveredAt: new Date(),
        });
      } catch (dbErr) {
        console.error("[ID Cards] Failed to save history:", dbErr);
      }
    }

    // Add note to AgencyZoom
    if (body.contactId) {
      try {
        const azClient = getAgencyZoomClient();
        const noteContent = `ID Card sent via SMS to ${body.phone}\nPolicy: ${body.policyNumber}\n${body.carrier || ""}`;

        if (body.contactType === "customer") {
          await azClient.addNote(parseInt(body.contactId), noteContent);
        } else {
          await azClient.addLeadNote(parseInt(body.contactId), noteContent);
        }
      } catch (azErr) {
        console.error("[ID Cards] Failed to add AZ note:", azErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `ID card sent to ${body.phone}`,
      messageId: smsResult.messageId,
    });
  } catch (error: any) {
    console.error("[ID Cards] Send SMS error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send SMS", details: error.message },
      { status: 500 }
    );
  }
}
