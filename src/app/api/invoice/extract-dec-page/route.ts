import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Check file type - GPT-4 Vision only supports images, not PDFs
    const mimeType = file.type || "image/png";
    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    if (!supportedTypes.includes(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${mimeType}. Please upload an image (JPG, PNG, GIF, or WebP). For PDFs, take a screenshot of the dec page first.`,
        },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Use GPT-4o-mini with vision to extract data from the dec page
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting insurance policy information from declarations pages.
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

If a field cannot be found, use an empty string for text fields or 0 for premium.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the policy information from this declarations page:",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content || "";

    // Parse the JSON response
    let extractedData;
    try {
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json(
        { success: false, error: "Failed to parse extracted data" },
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
    console.error("Dec page extraction error:", error);

    // Provide more specific error messages
    let errorMessage = "Failed to extract data from dec page";

    if (error?.code === "invalid_api_key" || error?.message?.includes("API key")) {
      errorMessage = "OpenAI API key is invalid or missing";
    } else if (error?.code === "insufficient_quota") {
      errorMessage = "OpenAI API quota exceeded";
    } else if (error?.message?.includes("Could not process image")) {
      errorMessage = "Could not process image - try a clearer image or PDF";
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
