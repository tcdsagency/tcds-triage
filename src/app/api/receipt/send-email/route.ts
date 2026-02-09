import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfBase64, receiptNumber, customerName, amount } = body;

    if (!pdfBase64 || !receiptNumber) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Initialize Resend inside the handler to avoid build-time errors
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Email service not configured" },
        { status: 503 }
      );
    }

    const resend = new Resend(apiKey);

    // Convert base64 to buffer for attachment
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // Format amount for display
    const formattedAmount = amount
      ? `$${parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      : "N/A";

    const { data, error } = await resend.emails.send({
      from: "TCDS Insurance Agency <receipts@tcdsinsurance.com>",
      to: ["agency@tcdsagency.com"],
      subject: `Payment Receipt - ${customerName || "Customer"} - ${receiptNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #059669; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">TCDS Insurance Agency</h1>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Payment Receipt</p>
          </div>

          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151;">
              A payment receipt has been generated for the following transaction:
            </p>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Receipt Number:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #111827; text-align: right; font-family: monospace;">${receiptNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Customer:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #111827; text-align: right;">${customerName || "N/A"}</td>
                </tr>
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0 8px 0; color: #374151; font-size: 16px; font-weight: bold;">Amount Received:</td>
                  <td style="padding: 12px 0 8px 0; font-weight: bold; color: #059669; text-align: right; font-size: 20px;">${formattedAmount}</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              The receipt PDF is attached to this email for your records.
            </p>
          </div>

          <div style="background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">TCDS Insurance Agency</p>
            <p style="margin: 5px 0 0 0;">Phone: (205) 847-5616 | Email: agency@tcdsagency.com</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Receipt-${receiptNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
    });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 }
    );
  }
}
