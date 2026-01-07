// API Route: /api/id-cards/generate
// Generate PDF ID card for Texas auto insurance

import { NextRequest, NextResponse } from "next/server";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";

// =============================================================================
// TYPES
// =============================================================================

interface Vehicle {
  year: string;
  make: string;
  model: string;
  vin: string;
}

interface GenerateRequest {
  insuredName: string;
  spouseName?: string;
  carrier: string;
  carrierNaic?: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  vehicles: Vehicle[];
}

// =============================================================================
// PDF FONTS
// =============================================================================

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function createIdCardPage(data: GenerateRequest, vehicle: Vehicle): Content[] {
  const insuredDisplay = data.spouseName
    ? `${data.insuredName} & ${data.spouseName}`
    : data.insuredName;

  const vehicleDisplay = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();

  return [
    // Header
    {
      text: "TEXAS MOTOR VEHICLE LIABILITY INSURANCE ID CARD",
      style: "header",
      alignment: "center" as const,
      margin: [0, 0, 0, 15],
    },
    // Border box
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                // Row 1: Carrier & NAIC
                {
                  columns: [
                    {
                      width: "*",
                      stack: [
                        { text: "INSURANCE COMPANY", style: "label" },
                        { text: data.carrier, style: "value" },
                      ],
                    },
                    {
                      width: 80,
                      stack: [
                        { text: "NAIC #", style: "label" },
                        { text: data.carrierNaic || "N/A", style: "value" },
                      ],
                    },
                  ],
                  margin: [0, 0, 0, 10],
                },
                // Row 2: Insured
                {
                  stack: [
                    { text: "INSURED", style: "label" },
                    { text: insuredDisplay, style: "value" },
                  ],
                  margin: [0, 0, 0, 10],
                },
                // Row 3: Policy Number & Dates
                {
                  columns: [
                    {
                      width: "*",
                      stack: [
                        { text: "POLICY NUMBER", style: "label" },
                        { text: data.policyNumber, style: "value" },
                      ],
                    },
                    {
                      width: 90,
                      stack: [
                        { text: "EFFECTIVE", style: "label" },
                        { text: formatDate(data.effectiveDate), style: "value" },
                      ],
                    },
                    {
                      width: 90,
                      stack: [
                        { text: "EXPIRATION", style: "label" },
                        { text: formatDate(data.expirationDate), style: "value" },
                      ],
                    },
                  ],
                  margin: [0, 0, 0, 10],
                },
                // Row 4: Vehicle
                {
                  stack: [
                    { text: "VEHICLE", style: "label" },
                    { text: vehicleDisplay || "All Vehicles", style: "value" },
                  ],
                  margin: [0, 0, 0, 5],
                },
                // Row 5: VIN
                {
                  stack: [
                    { text: "VIN", style: "label" },
                    { text: vehicle.vin || "N/A", style: "vinValue" },
                  ],
                },
              ],
              margin: [15, 15, 15, 15],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 2,
        vLineWidth: () => 2,
        hLineColor: () => "#000000",
        vLineColor: () => "#000000",
      },
    },
    // Footer disclaimer
    {
      text: "This card must be carried in the insured vehicle at all times as proof of financial responsibility.",
      style: "disclaimer",
      alignment: "center" as const,
      margin: [0, 10, 0, 0],
    },
  ];
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    // Validate required fields
    if (!body.insuredName || !body.carrier || !body.policyNumber) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: insuredName, carrier, policyNumber" },
        { status: 400 }
      );
    }

    if (!body.vehicles || body.vehicles.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one vehicle is required" },
        { status: 400 }
      );
    }

    // Build document content - one page per vehicle
    const content: Content[] = [];

    body.vehicles.forEach((vehicle, index) => {
      if (index > 0) {
        content.push({ text: "", pageBreak: "before" });
      }
      content.push(...createIdCardPage(body, vehicle));
    });

    // Create PDF document definition
    const docDefinition: TDocumentDefinitions = {
      pageSize: "LETTER",
      pageMargins: [40, 40, 40, 40],
      content,
      styles: {
        header: {
          fontSize: 12,
          bold: true,
        },
        label: {
          fontSize: 8,
          color: "#666666",
          margin: [0, 0, 0, 2],
        },
        value: {
          fontSize: 11,
          bold: true,
        },
        vinValue: {
          fontSize: 9,
          bold: true,
          font: "Helvetica",
        },
        disclaimer: {
          fontSize: 7,
          italics: true,
          color: "#666666",
        },
      },
      defaultStyle: {
        font: "Helvetica",
      },
    };

    // Generate PDF
    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Collect PDF chunks
    const chunks: Buffer[] = [];

    return new Promise<NextResponse>((resolve) => {
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        const pdfBase64 = pdfBuffer.toString("base64");

        resolve(
          NextResponse.json({
            success: true,
            pdf: pdfBase64,
            vehicleCount: body.vehicles.length,
            filename: `ID_Card_${body.policyNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          })
        );
      });
      pdfDoc.on("error", (err: Error) => {
        console.error("[ID Cards] PDF generation error:", err);
        resolve(
          NextResponse.json(
            { success: false, error: "Failed to generate PDF" },
            { status: 500 }
          )
        );
      });
      pdfDoc.end();
    });
  } catch (error: any) {
    console.error("[ID Cards] Generate error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate ID card", details: error.message },
      { status: 500 }
    );
  }
}
