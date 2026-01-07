// =============================================================================
// AI QUOTE ASSISTANT API
// Handles conversation, data extraction, and completion tracking
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getQuoteSchema,
  calculateCompleteness,
  getMissingFields,
  getNextFieldsToCollect,
  QuoteData,
  ConversationMessage,
  QuoteType,
} from "@/lib/quote-schemas";

const anthropic = new Anthropic();

// =============================================================================
// TYPES
// =============================================================================

interface QuoteAssistantRequest {
  action: "start" | "message" | "extract" | "validate" | "vin_decode";
  quoteType?: QuoteType;
  message?: string;
  quoteData?: QuoteData;
  vin?: string;
  customerId?: string;
  customerContext?: {
    name?: string;
    isExisting?: boolean;
    existingPolicies?: string[];
  };
}

interface QuoteAssistantResponse {
  success: boolean;
  assistantMessage?: string;
  extractedData?: Record<string, any>;
  extractedArrays?: Record<string, any[]>;
  confidence?: Record<string, number>;
  completeness?: number;
  missingFields?: string[];
  suggestedQuestions?: string[];
  isComplete?: boolean;
  vinData?: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    bodyType?: string;
  };
  error?: string;
}

// =============================================================================
// VIN DECODER (NHTSA API)
// =============================================================================

async function decodeVIN(vin: string): Promise<QuoteAssistantResponse["vinData"] | null> {
  try {
    // Clean VIN - remove spaces and convert to uppercase
    const cleanVin = vin.replace(/\s/g, "").toUpperCase();
    
    // Basic VIN validation
    if (cleanVin.length !== 17) {
      return null;
    }
    
    // Check for invalid characters (I, O, Q are not used in VINs)
    if (/[IOQ]/.test(cleanVin)) {
      return null;
    }

    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${cleanVin}?format=json`
    );
    
    if (!response.ok) {
      console.error("VIN decode API error:", response.status);
      return null;
    }

    const data = await response.json();
    const results = data.Results || [];

    // Extract relevant fields from NHTSA response
    const getValue = (variableId: number) => {
      const result = results.find((r: any) => r.VariableId === variableId);
      return result?.Value || null;
    };

    const year = getValue(29); // Model Year
    const make = getValue(26); // Make
    const model = getValue(28); // Model
    const trim = getValue(38); // Trim
    const bodyClass = getValue(5); // Body Class

    if (!year || !make || !model) {
      return null;
    }

    return {
      year: parseInt(year),
      make,
      model,
      trim: trim || undefined,
      bodyType: bodyClass || undefined,
    };
  } catch (error) {
    console.error("VIN decode error:", error);
    return null;
  }
}

// =============================================================================
// AI EXTRACTION PROMPT BUILDER
// =============================================================================

function buildExtractionPrompt(
  schema: any,
  currentData: Record<string, any>,
  currentArrays: Record<string, any[]>,
  userMessage: string,
  conversationHistory: ConversationMessage[]
): string {
  // Build a summary of what we already have
  const collectedSummary: string[] = [];
  
  for (const group of schema.groups) {
    if (group.isArray) {
      const items = currentArrays[group.key] || [];
      if (items.length > 0) {
        collectedSummary.push(`${group.label}: ${items.length} items`);
        items.forEach((item, i) => {
          const itemDetails = Object.entries(item)
            .filter(([_, v]) => v !== undefined && v !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ");
          if (itemDetails) {
            collectedSummary.push(`  - Item ${i + 1}: ${itemDetails}`);
          }
        });
      }
    } else {
      for (const field of group.fields) {
        if (currentData[field.key] !== undefined && currentData[field.key] !== "") {
          collectedSummary.push(`${field.label}: ${currentData[field.key]}`);
        }
      }
    }
  }

  // Build field definitions for extraction
  const fieldDefinitions: string[] = [];
  
  for (const group of schema.groups) {
    fieldDefinitions.push(`\n## ${group.label}`);
    if (group.isArray) {
      fieldDefinitions.push(`(Array - can have multiple ${group.itemLabel || "items"})`);
    }
    
    for (const field of group.fields) {
      let def = `- ${field.key}: ${field.label} (${field.type})`;
      if (field.options) {
        def += ` - Options: ${field.options.map((o: any) => o.value).join(", ")}`;
      }
      if (field.extractionHints) {
        def += ` - Hints: ${field.extractionHints.join(", ")}`;
      }
      if (field.showIf) {
        def += ` - Only if: ${field.showIf}`;
      }
      fieldDefinitions.push(def);
    }
  }

  // Get recent conversation for context
  const recentConversation = conversationHistory
    .slice(-10)
    .map(m => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`)
    .join("\n");

  return `You are an AI assistant helping collect insurance quote information. Your job is to:
1. Extract structured data from the user's message
2. Generate a helpful, conversational response
3. Ask follow-up questions to collect missing information

## Schema Fields Available:
${fieldDefinitions.join("\n")}

## Data Already Collected:
${collectedSummary.length > 0 ? collectedSummary.join("\n") : "Nothing yet"}

## Recent Conversation:
${recentConversation || "This is the start of the conversation"}

## User's Latest Message:
"${userMessage}"

## Your Task:
Analyze the user's message and respond with a JSON object containing:

{
  "extractedData": {
    // Key-value pairs of any NEW data you can extract from the user's message
    // Only include fields that the user actually provided information about
    // Use the exact field keys from the schema
  },
  "extractedArrayItems": {
    // For array fields (like drivers, vehicles), include new items to add
    // Format: { "arrayKey": [{ field: value, ... }] }
  },
  "confidence": {
    // For each extracted field, a confidence score from 0 to 1
    // e.g., { "firstName": 0.95, "maritalStatus": 0.8 }
  },
  "needsClarification": [
    // List of field keys where you extracted something but aren't sure
  ],
  "assistantResponse": "Your conversational response to the user. Be friendly, acknowledge what they said, and ask about the next most important missing information. Don't ask too many questions at once - focus on 1-2 things.",
  "internalNotes": "Any observations about the customer or quote that might be useful"
}

## Extraction Guidelines:
- If user says "wife/husband/spouse", they are married (maritalStatus = "married")
- If user says "paid off" or "own it", ownership = "owned"
- If user says "making payments" or "financing", ownership = "financed"
- If user mentions a car (like "2023 Tesla Model Y"), extract year, make, model
- If user gives an address, try to parse street, city, state, zip
- Phone numbers should be extracted as 10 digits only
- Dates should be in ISO format (YYYY-MM-DD) or natural language
- If user mentions kids who drive, they're additional drivers with relationship = "child"
- If user says they "work from home", vehicle usage is likely "pleasure" or low mileage
- Extract names in firstName/lastName format when possible

## Response Guidelines:
- Be conversational and friendly, not robotic
- Acknowledge what the user shared before asking for more
- Explain WHY you need certain information when appropriate
- If something is unclear, ask for clarification
- Prioritize getting critical info first (drivers, vehicles, contact info)
- Don't overwhelm - ask about 1-2 things at a time
- If they seem frustrated, offer to let them provide info however is easiest

Respond ONLY with the JSON object, no other text.`;
}

// =============================================================================
// AI CONVERSATION HANDLER
// =============================================================================

async function processConversation(
  schema: any,
  quoteData: QuoteData,
  userMessage: string
): Promise<QuoteAssistantResponse> {
  try {
    const prompt = buildExtractionPrompt(
      schema,
      quoteData.data,
      quoteData.arrays,
      userMessage,
      quoteData.conversationHistory
    );

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract the text content
    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Parse the JSON response
    let aiResponse: any;
    try {
      // Try to extract JSON from the response (sometimes there's extra text)
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", textContent.text);
      // Return a generic response if parsing fails
      return {
        success: true,
        assistantMessage: "I didn't quite catch that. Could you tell me more about what vehicles you need to insure and who will be driving them?",
        extractedData: {},
        completeness: calculateCompleteness(schema, quoteData.data, quoteData.arrays),
        missingFields: getMissingFields(schema, quoteData.data, quoteData.arrays),
      };
    }

    // Merge extracted data with existing data
    const newData = { ...quoteData.data, ...aiResponse.extractedData };
    const newArrays = { ...quoteData.arrays };
    
    // Handle array items
    if (aiResponse.extractedArrayItems) {
      for (const [key, items] of Object.entries(aiResponse.extractedArrayItems)) {
        if (Array.isArray(items) && items.length > 0) {
          if (!newArrays[key]) {
            newArrays[key] = [];
          }
          newArrays[key] = [...newArrays[key], ...items];
        }
      }
    }

    // Calculate completeness with new data
    const completeness = calculateCompleteness(schema, newData, newArrays);
    const missingFields = getMissingFields(schema, newData, newArrays);
    const isComplete = completeness >= 90 && missingFields.length === 0;

    return {
      success: true,
      assistantMessage: aiResponse.assistantResponse,
      extractedData: aiResponse.extractedData || {},
      extractedArrays: aiResponse.extractedArrayItems || {},
      confidence: aiResponse.confidence || {},
      completeness,
      missingFields,
      suggestedQuestions: getNextFieldsToCollect(schema, newData, newArrays, 3),
      isComplete,
    };
  } catch (error) {
    console.error("AI conversation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process message",
    };
  }
}

// =============================================================================
// API ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<QuoteAssistantResponse>> {
  try {
    const body: QuoteAssistantRequest = await request.json();
    const { action, quoteType, message, quoteData, vin, customerId, customerContext } = body;

    // Handle VIN decode action
    if (action === "vin_decode" && vin) {
      const vinData = await decodeVIN(vin);
      if (vinData) {
        return NextResponse.json({
          success: true,
          vinData,
          assistantMessage: `I decoded your VIN. This is a ${vinData.year} ${vinData.make} ${vinData.model}${vinData.trim ? ` ${vinData.trim}` : ""}. Is that correct?`,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: "Could not decode VIN. Please check that it's a valid 17-character VIN.",
          assistantMessage: "I couldn't decode that VIN. Could you double-check it? It should be 17 characters, usually found on your registration or on the dashboard near the windshield.",
        });
      }
    }

    // Handle start action - initialize a new quote
    if (action === "start") {
      if (!quoteType) {
        return NextResponse.json({
          success: false,
          error: "Quote type is required to start",
        });
      }

      const schema = getQuoteSchema(quoteType);
      if (!schema) {
        return NextResponse.json({
          success: false,
          error: `Quote type "${quoteType}" is not yet available`,
        });
      }

      // Generate opening message
      let openingMessage = schema.aiConfig.openingMessage;
      
      // Personalize if we have customer context
      if (customerContext?.name && customerContext?.isExisting) {
        openingMessage = `Hi ${customerContext.name}! Great to see you again. ${openingMessage}`;
        if (customerContext.existingPolicies?.length) {
          openingMessage += ` I see you already have ${customerContext.existingPolicies.join(" and ")} with us - we might be able to bundle for additional savings!`;
        }
      }

      return NextResponse.json({
        success: true,
        assistantMessage: openingMessage,
        extractedData: customerContext?.isExisting ? { isExistingCustomer: true } : {},
        completeness: 0,
        missingFields: getMissingFields(schema, {}, {}),
        suggestedQuestions: getNextFieldsToCollect(schema, {}, {}, 3),
        isComplete: false,
      });
    }

    // Handle message action - process user message
    if (action === "message") {
      if (!message) {
        return NextResponse.json({
          success: false,
          error: "Message is required",
        });
      }

      if (!quoteData) {
        return NextResponse.json({
          success: false,
          error: "Quote data is required to process message",
        });
      }

      const schema = getQuoteSchema(quoteData.schemaId as QuoteType);
      if (!schema) {
        return NextResponse.json({
          success: false,
          error: "Invalid quote schema",
        });
      }

      // Check if message contains a VIN and auto-decode
      const vinMatch = message.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
      if (vinMatch) {
        const vinData = await decodeVIN(vinMatch[0]);
        if (vinData) {
          // Add VIN data to the extraction
          const result = await processConversation(schema, quoteData, message);
          if (result.success) {
            // Merge VIN data
            result.extractedData = {
              ...result.extractedData,
            };
            result.extractedArrays = {
              ...result.extractedArrays,
              vehicles: [
                ...(result.extractedArrays?.vehicles || []),
                {
                  vin: vinMatch[0].toUpperCase(),
                  year: vinData.year,
                  make: vinData.make,
                  model: vinData.model,
                  trim: vinData.trim,
                },
              ],
            };
            result.vinData = vinData;
          }
          return NextResponse.json(result);
        }
      }

      // Process the conversation normally
      const result = await processConversation(schema, quoteData, message);
      return NextResponse.json(result);
    }

    // Handle validate action - check completeness
    if (action === "validate") {
      if (!quoteData) {
        return NextResponse.json({
          success: false,
          error: "Quote data is required for validation",
        });
      }

      const schema = getQuoteSchema(quoteData.schemaId as QuoteType);
      if (!schema) {
        return NextResponse.json({
          success: false,
          error: "Invalid quote schema",
        });
      }

      const completeness = calculateCompleteness(schema, quoteData.data, quoteData.arrays);
      const missingFields = getMissingFields(schema, quoteData.data, quoteData.arrays);
      const isComplete = completeness >= 90 && missingFields.length === 0;

      let assistantMessage: string;
      if (isComplete) {
        assistantMessage = schema.aiConfig.completionMessage;
      } else {
        assistantMessage = `We're ${completeness}% complete. I still need: ${missingFields.slice(0, 3).join(", ")}${missingFields.length > 3 ? `, and ${missingFields.length - 3} more items` : ""}.`;
      }

      return NextResponse.json({
        success: true,
        assistantMessage,
        completeness,
        missingFields,
        isComplete,
        suggestedQuestions: getNextFieldsToCollect(schema, quoteData.data, quoteData.arrays, 5),
      });
    }

    return NextResponse.json({
      success: false,
      error: "Invalid action",
    });
  } catch (error) {
    console.error("Quote assistant error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "An error occurred",
    });
  }
}
