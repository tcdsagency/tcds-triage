// API Route: /api/id-cards/send-sms
// Send ID card as MMS image via Twilio

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generatedIdCards } from "@/db/schema";
import { twilioClient } from "@/lib/twilio";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

// Twilio sender number for ID cards
const TWILIO_ID_CARD_NUMBER = "+12058475616";

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

    // Upload media to get a public URL for MMS
    // Twilio MMS requires a publicly accessible URL
    let mediaUrl = "";
    const storageEndpoint = process.env.STORAGE_UPLOAD_ENDPOINT;
    const storagePublicUrl = process.env.STORAGE_PUBLIC_URL;

    if (storageEndpoint) {
      try {
        // Upload as PNG image for better MMS compatibility
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
          mediaUrl = result.url || (storagePublicUrl ? `${storagePublicUrl}/${filename}` : "");
        }
      } catch (err) {
        console.error("[ID Cards] Storage upload error:", err);
      }
    }

    // If no storage configured, return error
    if (!mediaUrl) {
      return NextResponse.json({
        success: false,
        error: "Media storage not configured. Set STORAGE_UPLOAD_ENDPOINT to enable MMS delivery.",
      }, { status: 500 });
    }

    // Send MMS with the ID card
    const message = `Hi ${body.insuredName.split(" ")[0]}! Here's your insurance ID card for policy ${body.policyNumber}. Keep this in your vehicle. - TCDS Agency`;

    const mmsResult = await twilioClient.sendMMS({
      to: body.phone,
      message,
      mediaUrl,
      from: TWILIO_ID_CARD_NUMBER, // Use dedicated ID card number
    });

    if (!mmsResult.success) {
      return NextResponse.json({
        success: false,
        error: mmsResult.error || "Failed to send MMS",
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
        const noteContent = `ID Card sent via MMS to ${body.phone}\nPolicy: ${body.policyNumber}\n${body.carrier || ""}`;

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
      messageId: mmsResult.messageId,
      from: TWILIO_ID_CARD_NUMBER,
    });
  } catch (error: any) {
    console.error("[ID Cards] Send SMS error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send MMS", details: error.message },
      { status: 500 }
    );
  }
}
