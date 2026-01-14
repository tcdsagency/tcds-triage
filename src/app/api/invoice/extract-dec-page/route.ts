import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { extractText } from "unpdf";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EXTRACTION_PROMPT = `You are an expert at extracting insurance policy information from declarations pages.
Extract the following fields from the document. Return ONLY valid JSON, no markdown or explanation.

Required fields:
- customerName: Full name of the insured
- street: Street address
- city: City name
- state: 2-letter state code
- zip: 5-digit ZIP code
- policyNumber: Policy number/ID
- carrier: Insurance carrier name
- effectiveDate: Policy effective date (MM/DD/YYYY format)
- expirationDate: Policy expiration date (MM/DD/YYYY format)
- lineOfBusiness: Type of insurance (Homeowners, Auto, Commercial Auto, Commercial Property, General Liability, Workers Comp, Umbrella, Flood, or Other)
- premium: Annual premium amount as a number (no $ or commas)

If a field cannot be found, use an empty string for text fields or 0 for premium.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const mimeType = file.type || "";
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let response;

    // Handle PDFs - extract text using unpdf (serverless-compatible)
    if (mimeType === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf")) {
      console.log("[Invoice] Processing PDF file:", file.name);

      // Extract text from PDF using unpdf (works in serverless/Vercel)
      const { text: pdfTextPages } = await extractText(buffer);
      const pdfText = Array.isArray(pdfTextPages) ? pdfTextPages.join("\n") : String(pdfTextPages);

      if (!pdfText || pdfText.trim().length < 50) {
        return NextResponse.json(
          { success: false, error: "Could not extract text from PDF. The PDF may be image-based - try uploading a screenshot instead." },
          { status: 400 }
        );
      }

      console.log("[Invoice] Extracted PDF text length:", pdfText.length);

      // Send extracted text to GPT for structured extraction
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Extract the policy information from this declarations page text:\n\n${pdfText.substring(0, 8000)}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0,
      });
    }
    // Handle images - use GPT-4o Vision
    else if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)) {
      console.log("[Invoice] Processing image file:", file.name);

      const base64 = buffer.toString("base64");

      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the policy information from this declarations page:" },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0,
      });
    }
    // Unsupported file type
    else {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${mimeType}. Please upload a PDF or image (JPG, PNG, GIF, WebP).` },
        { status: 400 }
      );
    }

    const content = response.choices[0]?.message?.content || "";

    // Parse the JSON response
    let extractedData;
    try {
      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("[Invoice] Failed to parse AI response:", content);
      return NextResponse.json(
        { success: false, error: "Failed to parse extracted data from AI response" },
        { status: 500 }
      );
    }

    // Normalize the data
    const normalizedData = {
      customerName: extractedData.customerName || "",
      street: extractedData.street || "",
      city: extractedData.city || "",
      state: extractedData.state || "",
      zip: extractedData.zip || "",
      policyNumber: extractedData.policyNumber || "",
      carrier: extractedData.carrier || "",
      effectiveDate: extractedData.effectiveDate || "",
      expirationDate: extractedData.expirationDate || "",
      lineOfBusiness: extractedData.lineOfBusiness || "",
      premium: typeof extractedData.premium === "number"
        ? extractedData.premium
        : parseFloat(String(extractedData.premium).replace(/[,$]/g, "")) || 0,
    };

    return NextResponse.json({
      success: true,
      data: normalizedData,
      tokensUsed: response.usage?.total_tokens || 0,
    });
  } catch (error: any) {
    console.error("[Invoice] Dec page extraction error:", error);

    let errorMessage = "Failed to extract data from dec page";

    if (error?.code === "invalid_api_key" || error?.message?.includes("API key")) {
      errorMessage = "OpenAI API key is invalid or missing";
    } else if (error?.code === "insufficient_quota") {
      errorMessage = "OpenAI API quota exceeded";
    } else if (error?.message?.includes("Could not process image")) {
      errorMessage = "Could not process image - try a clearer image";
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
