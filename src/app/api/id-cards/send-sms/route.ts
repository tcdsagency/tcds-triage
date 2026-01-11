// API Route: /api/id-cards/send-sms
// Send ID card as MMS image via Twilio

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { generatedIdCards } from "@/db/schema";
import { twilioClient } from "@/lib/twilio";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";
import { createClient } from "@supabase/supabase-js";

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

    // Upload media to Supabase Storage to get a public URL for MMS
    // Twilio MMS requires a publicly accessible URL
    let mediaUrl = "";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Convert base64 to buffer
        const pdfBuffer = Buffer.from(body.pdfBase64, "base64");
        const filename = `id-cards/${Date.now()}_${body.policyNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

        console.log("[ID Cards] Uploading to Supabase Storage:", filename, "size:", pdfBuffer.length);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from("public-files")
          .upload(filename, pdfBuffer, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (error) {
          console.error("[ID Cards] Supabase upload error:", error.message);

          // If bucket doesn't exist, try to create it
          if (error.message?.includes("not found") || error.message?.includes("Bucket") || error.message?.includes("bucket")) {
            console.log("[ID Cards] Bucket not found, attempting to create...");
            const { error: bucketError } = await supabase.storage.createBucket("public-files", {
              public: true,
              allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
            });

            if (bucketError) {
              console.error("[ID Cards] Failed to create bucket:", bucketError.message);
            } else {
              console.log("[ID Cards] Bucket created, retrying upload...");
              // Retry upload
              const { data: retryData, error: retryError } = await supabase.storage
                .from("public-files")
                .upload(filename, pdfBuffer, {
                  contentType: "application/pdf",
                  upsert: true,
                });

              if (retryError) {
                console.error("[ID Cards] Retry upload failed:", retryError.message);
              } else if (retryData) {
                const { data: urlData } = supabase.storage.from("public-files").getPublicUrl(filename);
                mediaUrl = urlData.publicUrl;
                console.log("[ID Cards] Upload successful (after retry):", mediaUrl);
              }
            }
          }
        } else if (data) {
          const { data: urlData } = supabase.storage.from("public-files").getPublicUrl(filename);
          mediaUrl = urlData.publicUrl;
          console.log("[ID Cards] Upload successful:", mediaUrl);
        }
      } catch (err: any) {
        console.error("[ID Cards] Storage upload error:", err.message || err);
      }
    } else {
      console.error("[ID Cards] Supabase not configured - missing URL or service key");
    }

    // If no storage configured or upload failed, return error
    if (!mediaUrl) {
      return NextResponse.json({
        success: false,
        error: "Failed to upload ID card for MMS delivery. Please check Supabase Storage configuration.",
      }, { status: 500 });
    }

    // Send MMS with the ID card
    const message = `Hi ${body.insuredName.split(" ")[0]}! Here's your insurance ID card for policy ${body.policyNumber}. Keep this in your vehicle.

You can also download our app for 24/7 access to your policy, ID cards, billing and more! https://x5b7.app.link/insurance-agent-app

- TCDS Agency`;

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
