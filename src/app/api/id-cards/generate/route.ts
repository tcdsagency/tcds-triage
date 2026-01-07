// API Route: /api/id-cards/generate
// Generate PDF ID card using fillable PDF template

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

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

// Template form field names
const FIELD_NAMES = {
  carrier: "Carrier_Name",
  naic: "Carrier_NAIC",
  policy: "Policy_Num",
  effDate: "Eff_Date",
  expDate: "Exp_Date",
  insured1: "Insured_Name_1",
  insured2: "Driver 2 Name",
  // Vehicle 1 (top card)
  veh1Year: "Veh_1_Year",
  veh1Make: "Veh_1_Make",
  veh1Model: "Veh_1_Model",
  veh1Vin: "Veh_1_Vin",
  // Vehicle 2 (bottom card)
  veh2Year: "Veh_2_Year",
  veh2Make: "Veh_2_Make",
  veh2Model: "Veh_2_Model",
  veh2Vin: "Veh_2_Vin",
};

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

    // Load PDF template from public URL (works in serverless environment)
    let baseUrl = "http://localhost:3000";
    if (process.env.NEXTAUTH_URL) {
      baseUrl = process.env.NEXTAUTH_URL;
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    const templateUrl = `${baseUrl}/templates/IDCard_Template_1767336446487.pdf`;

    let templateBytes: ArrayBuffer;
    try {
      const response = await fetch(templateUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      templateBytes = await response.arrayBuffer();
    } catch (err: any) {
      console.error("[ID Cards] Template fetch error:", err.message, "URL:", templateUrl);
      return NextResponse.json(
        { success: false, error: "ID card template not found", details: err.message },
        { status: 500 }
      );
    }

    // Create output PDF
    const outputPdf = await PDFDocument.create();

    // Calculate number of pages needed (2 vehicles per page)
    const vehicleCount = body.vehicles.length;
    const pagesNeeded = Math.ceil(vehicleCount / 2);

    // Process vehicles in pairs
    for (let pageIndex = 0; pageIndex < pagesNeeded; pageIndex++) {
      // Load fresh template for each page
      const templatePdf = await PDFDocument.load(templateBytes);
      const form = templatePdf.getForm();

      // Get vehicles for this page
      const veh1 = body.vehicles[pageIndex * 2];
      const veh2 = body.vehicles[pageIndex * 2 + 1];

      // Fill common fields
      try {
        const carrierField = form.getTextField(FIELD_NAMES.carrier);
        carrierField.setText(body.carrier || "");
      } catch (e) { /* Field may not exist */ }

      try {
        const naicField = form.getTextField(FIELD_NAMES.naic);
        naicField.setText(body.carrierNaic || "");
      } catch (e) { /* Field may not exist */ }

      try {
        const policyField = form.getTextField(FIELD_NAMES.policy);
        policyField.setText(body.policyNumber || "");
      } catch (e) { /* Field may not exist */ }

      try {
        const effDateField = form.getTextField(FIELD_NAMES.effDate);
        effDateField.setText(formatDate(body.effectiveDate));
      } catch (e) { /* Field may not exist */ }

      try {
        const expDateField = form.getTextField(FIELD_NAMES.expDate);
        expDateField.setText(formatDate(body.expirationDate));
      } catch (e) { /* Field may not exist */ }

      try {
        const insured1Field = form.getTextField(FIELD_NAMES.insured1);
        insured1Field.setText(body.insuredName || "");
      } catch (e) { /* Field may not exist */ }

      try {
        const insured2Field = form.getTextField(FIELD_NAMES.insured2);
        insured2Field.setText(body.spouseName || "");
      } catch (e) { /* Field may not exist */ }

      // Fill Vehicle 1 (top card)
      if (veh1) {
        try {
          form.getTextField(FIELD_NAMES.veh1Year).setText(veh1.year || "");
        } catch (e) { /* Field may not exist */ }
        try {
          form.getTextField(FIELD_NAMES.veh1Make).setText(veh1.make || "");
        } catch (e) { /* Field may not exist */ }
        try {
          form.getTextField(FIELD_NAMES.veh1Model).setText(veh1.model || "");
        } catch (e) { /* Field may not exist */ }
        try {
          form.getTextField(FIELD_NAMES.veh1Vin).setText(veh1.vin || "");
        } catch (e) { /* Field may not exist */ }
      }

      // Fill Vehicle 2 (bottom card)
      if (veh2) {
        try {
          form.getTextField(FIELD_NAMES.veh2Year).setText(veh2.year || "");
        } catch (e) { /* Field may not exist */ }
        try {
          form.getTextField(FIELD_NAMES.veh2Make).setText(veh2.make || "");
        } catch (e) { /* Field may not exist */ }
        try {
          form.getTextField(FIELD_NAMES.veh2Model).setText(veh2.model || "");
        } catch (e) { /* Field may not exist */ }
        try {
          form.getTextField(FIELD_NAMES.veh2Vin).setText(veh2.vin || "");
        } catch (e) { /* Field may not exist */ }
      }

      // Flatten the form to make it non-editable
      form.flatten();

      // Copy filled page to output PDF
      const [copiedPage] = await outputPdf.copyPages(templatePdf, [0]);
      outputPdf.addPage(copiedPage);
    }

    // Generate final PDF
    const pdfBytes = await outputPdf.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    return NextResponse.json({
      success: true,
      pdf: pdfBase64,
      vehicleCount: body.vehicles.length,
      pageCount: pagesNeeded,
      filename: `ID_Card_${body.policyNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
    });
  } catch (error: any) {
    console.error("[ID Cards] Generate error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate ID card", details: error.message },
      { status: 500 }
    );
  }
}
