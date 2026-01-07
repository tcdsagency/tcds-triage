// API Route: /api/quote-extractor/email/import
// Import a PDF attachment from email and extract quote data

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quoteDocuments } from "@/db/schema";
import { eq } from "drizzle-orm";

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

// PDF Text Extraction (same as upload route)
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || "";
  } catch (err) {
    console.warn("[Quote Extractor] pdf-parse not available, using fallback", err);
  }

  // Fallback extraction
  const bytes = new Uint8Array(pdfBuffer);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const textMatches: string[] = [];

  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;
  while ((match = streamRegex.exec(text)) !== null) {
    const readable = match[1]
      .replace(/[^\x20-\x7E\n\r]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (readable.length > 10) textMatches.push(readable);
  }

  const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
  while ((match = btEtRegex.exec(text)) !== null) {
    const textContent = match[1]
      .replace(/\(([^)]*)\)/g, "$1 ")
      .replace(/[^\x20-\x7E\n\r]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (textContent.length > 5) textMatches.push(textContent);
  }

  return textMatches.join("\n\n") || "Unable to extract text from PDF";
}

// GPT-4o Extraction (same as upload route)
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

Extract and return as JSON with these fields:
{
  "carrierName": "Insurance carrier name",
  "quoteType": "auto|home|renters|umbrella|recreational|commercial_auto|general_liability|bop|workers_comp|other",
  "quotedPremium": numeric premium (number only),
  "termMonths": policy term in months,
  "effectiveDate": "YYYY-MM-DD",
  "expirationDate": "YYYY-MM-DD",
  "quoteNumber": "Quote number",
  "customerName": "Full name",
  "customerAddress": "Street address",
  "customerCity": "City",
  "customerState": "State abbreviation",
  "customerZip": "ZIP code",
  "customerPhone": "Phone",
  "customerEmail": "Email",
  "coverageDetails": { "liability": "...", "collision": "...", etc },
  "vehicleInfo": [{ "year": "...", "make": "...", "model": "...", "vin": "..." }],
  "propertyInfo": { "address": "...", "yearBuilt": "...", "squareFeet": "...", "roofType": "..." },
  "driverInfo": [{ "name": "...", "dob": "YYYY-MM-DD", "licenseNumber": "..." }]
}

Return ONLY valid JSON. Use null for undetermined fields.`;

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
            content: "You extract structured data from insurance documents. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    const completion = await response.json();
    const responseText = completion.choices?.[0]?.message?.content || "";

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractedQuoteData;
    }

    return {};
  } catch (error) {
    console.error("[Quote Extractor] GPT-4o extraction error:", error);
    return {};
  }
}

// POST - Import from email attachment
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { messageId, attachmentId, filename } = body;

    if (!messageId || !attachmentId) {
      return NextResponse.json(
        { success: false, error: "messageId and attachmentId are required" },
        { status: 400 }
      );
    }

    // Get email configuration
    const emailEndpoint = process.env.QUOTE_EXTRACTOR_EMAIL_ENDPOINT;
    const emailApiKey = process.env.QUOTE_EXTRACTOR_EMAIL_API_KEY;
    const agentMailEndpoint = process.env.AGENTMAIL_ENDPOINT;

    if (!emailEndpoint && !agentMailEndpoint) {
      return NextResponse.json({
        success: false,
        error: "Email integration not configured",
      }, { status: 400 });
    }

    let pdfBuffer: ArrayBuffer | null = null;
    let attachmentFilename = filename || "email-attachment.pdf";

    // Fetch attachment from external email API
    if (emailEndpoint && emailApiKey) {
      try {
        const response = await fetch(
          `${emailEndpoint}/messages/${messageId}/attachments/${attachmentId}`,
          {
            headers: {
              Authorization: `Bearer ${emailApiKey}`,
            },
          }
        );

        if (response.ok) {
          pdfBuffer = await response.arrayBuffer();
        }
      } catch (err) {
        console.error("[Quote Extractor] Failed to fetch attachment from email API:", err);
      }
    }

    // Try AgentMail as fallback
    if (!pdfBuffer && agentMailEndpoint) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const endpoint = agentMailEndpoint.startsWith("http")
          ? agentMailEndpoint
          : new URL(agentMailEndpoint, baseUrl).href;

        const response = await fetch(
          `${endpoint}/messages/${messageId}/attachments/${attachmentId}`,
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        if (response.ok) {
          pdfBuffer = await response.arrayBuffer();
        }
      } catch (err) {
        console.error("[Quote Extractor] Failed to fetch attachment from AgentMail:", err);
      }
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch attachment from email" },
        { status: 500 }
      );
    }

    // Create initial document record
    const [document] = await db
      .insert(quoteDocuments)
      .values({
        tenantId,
        originalFileName: attachmentFilename,
        fileSize: pdfBuffer.byteLength,
        mimeType: "application/pdf",
        source: "email",
        emailMessageId: messageId,
        status: "extracting",
      })
      .returning();

    try {
      // Extract text from PDF
      const pdfText = await extractTextFromPDF(pdfBuffer);

      if (!pdfText || pdfText.length < 50) {
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
        message: "Quote imported and extracted from email",
      });
    } catch (extractError: any) {
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
    console.error("[Quote Extractor] Email import error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to import from email", details: error.message },
      { status: 500 }
    );
  }
}
