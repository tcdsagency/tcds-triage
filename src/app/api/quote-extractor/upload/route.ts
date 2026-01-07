// API Route: /api/quote-extractor/upload
// Upload PDF and extract quote data using GPT-4o

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quoteDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

interface ExtractedQuoteData {
  carrierName?: string;
  quoteType?: string;
  quotedPremium?: number;
  termMonths?: number;
  effectiveDate?: string;
  expirationDate?: string;
  quoteNumber?: string;
  customerName?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;
  customerPhone?: string;
  customerEmail?: string;
  coverageDetails?: Record<string, any>;
  vehicleInfo?: Array<{
    year?: string;
    make?: string;
    model?: string;
    vin?: string;
  }>;
  propertyInfo?: {
    address?: string;
    yearBuilt?: string;
    squareFeet?: string;
    roofType?: string;
  };
  driverInfo?: Array<{
    name?: string;
    dob?: string;
    licenseNumber?: string;
  }>;
}

// =============================================================================
// PDF TEXT EXTRACTION
// =============================================================================

async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  // Use pdf-parse library if available, otherwise use basic extraction
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || "";
  } catch (err) {
    console.warn("[Quote Extractor] pdf-parse not available, using fallback", err);
  }

  // Fallback: Extract text using basic PDF string parsing
  // This is a simple approach that works for many PDFs
  const bytes = new Uint8Array(pdfBuffer);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  // Extract text between stream/endstream markers (simplified)
  const textMatches: string[] = [];
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;

  while ((match = streamRegex.exec(text)) !== null) {
    // Try to extract readable text from the stream
    const streamContent = match[1];
    const readable = streamContent
      .replace(/[^\x20-\x7E\n\r]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (readable.length > 10) {
      textMatches.push(readable);
    }
  }

  // Also try to find text in BT/ET blocks (text objects)
  const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
  while ((match = btEtRegex.exec(text)) !== null) {
    const textContent = match[1]
      .replace(/\(([^)]*)\)/g, "$1 ") // Extract text from parentheses
      .replace(/[^\x20-\x7E\n\r]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (textContent.length > 5) {
      textMatches.push(textContent);
    }
  }

  return textMatches.join("\n\n") || "Unable to extract text from PDF";
}

// =============================================================================
// GPT-4o EXTRACTION
// =============================================================================

async function extractQuoteDataWithAI(pdfText: string): Promise<ExtractedQuoteData> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!apiKey) {
    console.warn("[Quote Extractor] No OpenAI API key configured");
    return {};
  }

  const prompt = `You are an expert at extracting insurance quote information from documents.

Analyze the following text extracted from an insurance quote PDF and extract all relevant information.

TEXT FROM PDF:
${pdfText.slice(0, 15000)}

Extract the following fields and return as JSON:
{
  "carrierName": "Insurance carrier/company name",
  "quoteType": "auto|home|renters|umbrella|recreational|commercial_auto|general_liability|bop|workers_comp|other",
  "quotedPremium": numeric premium amount (number only, no $ or commas),
  "termMonths": policy term in months (typically 6 or 12),
  "effectiveDate": "YYYY-MM-DD format",
  "expirationDate": "YYYY-MM-DD format",
  "quoteNumber": "Quote/policy number if shown",
  "customerName": "Full name of insured",
  "customerAddress": "Street address",
  "customerCity": "City",
  "customerState": "State abbreviation (TX, CA, etc.)",
  "customerZip": "ZIP code",
  "customerPhone": "Phone number",
  "customerEmail": "Email address",
  "coverageDetails": {
    "liability": "Liability limits (e.g., 100/300/100)",
    "collision": "Collision deductible",
    "comprehensive": "Comprehensive deductible",
    "uninsuredMotorist": "UM/UIM limits",
    "medicalPayments": "Med pay limits",
    "rentalReimbursement": "Rental coverage",
    "roadside": "Roadside assistance",
    "dwellingCoverage": "Dwelling coverage amount (for home)",
    "personalProperty": "Personal property coverage",
    "liability": "Liability coverage",
    "medicalPayments": "Medical payments",
    "other": "Any other notable coverages"
  },
  "vehicleInfo": [
    {
      "year": "Vehicle year",
      "make": "Vehicle make",
      "model": "Vehicle model",
      "vin": "VIN number"
    }
  ],
  "propertyInfo": {
    "address": "Property address",
    "yearBuilt": "Year built",
    "squareFeet": "Square footage",
    "roofType": "Roof type/material"
  },
  "driverInfo": [
    {
      "name": "Driver full name",
      "dob": "Date of birth (YYYY-MM-DD)",
      "licenseNumber": "License number"
    }
  ]
}

Important rules:
- Return ONLY valid JSON, no other text
- Use null for fields that cannot be determined
- For premium, extract only the numeric value (e.g., 1234.56 not "$1,234.56")
- For dates, use YYYY-MM-DD format
- For quoteType, pick the best match from the allowed values
- Include all vehicles/drivers found in the document`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting structured data from insurance documents. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    const completion = await response.json();
    const responseText = completion.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      return extracted as ExtractedQuoteData;
    }

    return {};
  } catch (error) {
    console.error("[Quote Extractor] GPT-4o extraction error:", error);
    return {};
  }
}

// =============================================================================
// POST - Upload and Extract
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { success: false, error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Create initial document record
    const [document] = await db
      .insert(quoteDocuments)
      .values({
        tenantId,
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/pdf",
        source: "upload",
        status: "extracting",
      })
      .returning();

    try {
      // Read file content
      const arrayBuffer = await file.arrayBuffer();

      // Extract text from PDF
      const pdfText = await extractTextFromPDF(arrayBuffer);

      if (!pdfText || pdfText.length < 50) {
        // Update status to error
        await db
          .update(quoteDocuments)
          .set({
            status: "error",
            extractionError: "Unable to extract text from PDF. The file may be scanned or image-based.",
            updatedAt: new Date(),
          })
          .where(eq(quoteDocuments.id, document.id));

        return NextResponse.json({
          success: false,
          error: "Unable to extract text from PDF",
          documentId: document.id,
        }, { status: 400 });
      }

      // Extract data using GPT-4o
      const extractedData = await extractQuoteDataWithAI(pdfText);

      // Update document with extracted data
      const [updated] = await db
        .update(quoteDocuments)
        .set({
          status: "extracted",
          carrierName: extractedData.carrierName || null,
          quoteType: extractedData.quoteType as any || null,
          quotedPremium: extractedData.quotedPremium || null,
          termMonths: extractedData.termMonths || null,
          effectiveDate: extractedData.effectiveDate ? new Date(extractedData.effectiveDate) : null,
          expirationDate: extractedData.expirationDate ? new Date(extractedData.expirationDate) : null,
          quoteNumber: extractedData.quoteNumber || null,
          customerName: extractedData.customerName || null,
          customerAddress: extractedData.customerAddress || null,
          customerCity: extractedData.customerCity || null,
          customerState: extractedData.customerState || null,
          customerZip: extractedData.customerZip || null,
          customerPhone: extractedData.customerPhone || null,
          customerEmail: extractedData.customerEmail || null,
          coverageDetails: extractedData.coverageDetails || null,
          vehicleInfo: extractedData.vehicleInfo || null,
          propertyInfo: extractedData.propertyInfo || null,
          driverInfo: extractedData.driverInfo || null,
          rawExtraction: extractedData as any,
          extractedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(quoteDocuments.id, document.id))
        .returning();

      return NextResponse.json({
        success: true,
        document: updated,
        message: "Quote data extracted successfully",
      });
    } catch (extractError: any) {
      // Update status to error
      await db
        .update(quoteDocuments)
        .set({
          status: "error",
          extractionError: extractError.message || "Extraction failed",
          updatedAt: new Date(),
        })
        .where(eq(quoteDocuments.id, document.id));

      return NextResponse.json({
        success: false,
        error: "Extraction failed",
        details: extractError.message,
        documentId: document.id,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[Quote Extractor] Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Upload failed", details: error.message },
      { status: 500 }
    );
  }
}
