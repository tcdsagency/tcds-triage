import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, customerName, policyNumber, amount, pdfBase64 } = body;

    if (!to || !pdfBase64) {
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

    const { data, error } = await resend.emails.send({
      from: "TCDS Insurance Agency <invoices@tcdsinsurance.com>",
      to: [to],
      subject: `Invoice for Policy ${policyNumber || "N/A"}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #059669; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">TCDS Insurance Agency</h1>
          </div>

          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151;">Dear ${customerName || "Valued Customer"},</p>

            <p style="font-size: 16px; color: #374151;">
              Please find attached your invoice for policy <strong>${policyNumber || "N/A"}</strong>.
            </p>

            ${amount ? `
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Amount Due</p>
              <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: bold; color: #059669;">$${parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
            ` : ""}

            <p style="font-size: 16px; color: #374151;">
              Please make checks payable to <strong>TCDS Insurance Agency</strong> and mail to:
            </p>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 15px 0;">
              <p style="margin: 0; color: #374151;">
                TCDS Insurance Agency<br>
                PO BOX 1283<br>
                Pinson, AL 35126
              </p>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              If you have any questions about this invoice, please don't hesitate to contact us.
            </p>

            <p style="font-size: 16px; color: #374151;">
              Thank you for your business!
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
          filename: (() => {
            const parts = (customerName || "Customer").trim().split(/\s+/);
            return parts.length >= 2
              ? `${parts[0]}_${parts[parts.length - 1]}_EOI.pdf`
              : `${parts[0]}_EOI.pdf`;
          })(),
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
