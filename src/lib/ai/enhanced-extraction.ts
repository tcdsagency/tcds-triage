/**
 * Enhanced AI Extraction with Multi-Intent Detection
 * ==================================================
 * Extends basic transcript analysis with:
 * - Multi-intent detection for calls with multiple service requests
 * - Structured intent extraction for batch ticket creation
 * - Confidence scoring per intent
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ExtractedIntent {
  intentNumber: number;
  summary: string;
  requestType: string;
  categoryId: number | null;
  priorityId: number | null;
  description: string;
  transcriptExcerpt: string;
  confidence: number;
}

export interface EnhancedExtractionResult {
  // Multi-intent detection
  intentCount: number;
  intents: ExtractedIntent[];

  // Overall call summary (combines all intents)
  overallSummary: string;

  // Extracted data (from original analysis)
  customerName: string | null;
  policyNumbers: string[];
  phone: string | null;
  email: string | null;
  address: string | null;

  // Call metadata
  sentiment: 'positive' | 'neutral' | 'negative';
  callType: string | null;
  callQuality: 'meaningful_conversation' | 'voicemail' | 'brief_no_service';
  isHangup: boolean;

  // Action items (consolidated from all intents)
  actionItems: string[];
}

// Service request type to AgencyZoom category mapping
export const REQUEST_TYPE_TO_CATEGORY: Record<string, number> = {
  'billing inquiry': 1,     // Billing
  'policy change': 2,       // Policy Change
  'add vehicle': 2,         // Policy Change
  'remove vehicle': 2,      // Policy Change
  'add driver': 2,          // Policy Change
  'remove driver': 2,       // Policy Change
  'claims': 3,              // Claims
  'renewal': 4,             // Renewal
  'quote request': 5,       // Quote
  'cancel': 6,              // Cancellation
  'certificate': 7,         // Certificate Request
  'id card': 8,             // ID Card Request
  'general inquiry': 9,     // General Inquiry
  'address change': 2,      // Policy Change
  'coverage change': 2,     // Policy Change
};

// Default priority mapping
export const REQUEST_TYPE_TO_PRIORITY: Record<string, number> = {
  'cancel': 1,              // High priority
  'claims': 1,              // High priority
  'billing inquiry': 2,     // Medium priority
  'policy change': 2,       // Medium priority
  'renewal': 2,             // Medium priority
  'add vehicle': 3,         // Normal priority
  'remove vehicle': 3,      // Normal priority
  'quote request': 3,       // Normal priority
  'general inquiry': 4,     // Low priority
};

// =============================================================================
// ENHANCED EXTRACTION FUNCTION
// =============================================================================

export async function analyzeTranscriptWithIntents(
  transcript: string,
  durationSeconds: number = 0
): Promise<EnhancedExtractionResult | null> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || !transcript || transcript.length < 50) {
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: ENHANCED_EXTRACTION_PROMPT,
          },
          {
            role: 'user',
            content: `Call Duration: ${durationSeconds} seconds\n\nTranscript:\n${transcript}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('[Enhanced-Extraction] OpenAI API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON response
    const parsed = JSON.parse(content);

    // Map to our structure
    return mapToEnhancedResult(parsed);
  } catch (error) {
    console.error('[Enhanced-Extraction] Analysis error:', error);
    return null;
  }
}

// =============================================================================
// PROMPT
// =============================================================================

const ENHANCED_EXTRACTION_PROMPT = `You are an insurance agency call analyst with expertise in detecting multiple service requests within a single call.

Your task is to:
1. Analyze the call transcript
2. Identify ALL distinct service requests/intents (most calls have 1, some have 2-3)
3. Extract structured data for each intent

MULTI-INTENT DETECTION:
Many calls contain a single request. However, some customers call with multiple needs:
- "I need to add a car AND I have a billing question"
- "Can you send me ID cards? Also, I want to change my address"
- "I'm calling about my renewal, and my daughter got her license so add her too"

Each DISTINCT SERVICE REQUEST = 1 INTENT. Do NOT split a single request into multiple intents.

GOOD multi-intent examples:
- Intent 1: Add vehicle (policy change) + Intent 2: Billing question (billing) = 2 intents
- Intent 1: Request ID cards + Intent 2: Update address = 2 intents

NOT multi-intent (single intent):
- Asking questions about an endorsement being processed = 1 intent (policy change)
- Discussing options for a coverage change = 1 intent (policy change)
- Confirming details about a single request = 1 intent

INTENT FIELDS:
- summary: Brief description (1 sentence)
- requestType: billing inquiry|policy change|add vehicle|remove vehicle|add driver|remove driver|claims|renewal|quote request|cancel|certificate|id card|general inquiry|address change|coverage change
- description: Detailed description for service ticket (include all relevant details: names, dates, amounts, vehicles, etc.)
- transcriptExcerpt: The portion of transcript where this intent is discussed (50-200 chars)
- confidence: 0.0-1.0 how confident you are this is a distinct intent

OVERALL SUMMARY:
Provide a combined summary covering all intents in the call.
Format: "[Customer name if known] called to [primary request]. [Additional requests if any]."

EXTRACTED DATA:
Only include data explicitly mentioned:
- customerName: Full name if stated
- policyNumbers: Array of policy numbers mentioned
- phone, email, address: Contact info if provided
- Other specific data (VIN, amounts, dates)

CALL METADATA:
- sentiment: positive|neutral|negative
- callType: The PRIMARY type of call
- callQuality: meaningful_conversation|voicemail|brief_no_service
- isHangup: true if call ended without completion

ACTION ITEMS:
List ALL action items from ALL intents. Format: "WHO: WHAT"

Respond in this exact JSON format:
{
  "intentCount": 1,
  "intents": [
    {
      "intentNumber": 1,
      "summary": "Customer wants to add a 2024 Honda Accord",
      "requestType": "add vehicle",
      "description": "Add 2024 Honda Accord, VIN: 1HGCV1F34LA000001, to auto policy. Customer purchased yesterday, needs coverage immediately. Financed through Honda Financial.",
      "transcriptExcerpt": "I just bought a new car yesterday and need to add it to my insurance",
      "confidence": 0.95
    }
  ],
  "overallSummary": "John Smith called to add a newly purchased 2024 Honda Accord to his auto policy.",
  "customerName": "John Smith",
  "policyNumbers": ["PA-1234567"],
  "phone": null,
  "email": null,
  "address": null,
  "sentiment": "positive",
  "callType": "policy change",
  "callQuality": "meaningful_conversation",
  "isHangup": false,
  "actionItems": ["Agent: Add 2024 Honda Accord to policy", "Agent: Send updated declarations page"]
}`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface RawExtractionResponse {
  intentCount?: number;
  intents?: Array<{
    intentNumber?: number;
    summary?: string;
    requestType?: string;
    description?: string;
    transcriptExcerpt?: string;
    confidence?: number;
  }>;
  overallSummary?: string;
  customerName?: string | null;
  policyNumbers?: string[];
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  sentiment?: string;
  callType?: string;
  callQuality?: string;
  isHangup?: boolean;
  actionItems?: string[];
}

function mapToEnhancedResult(raw: RawExtractionResponse): EnhancedExtractionResult {
  const intents: ExtractedIntent[] = (raw.intents || []).map((intent, index) => ({
    intentNumber: intent.intentNumber || index + 1,
    summary: intent.summary || '',
    requestType: intent.requestType || 'general inquiry',
    categoryId: REQUEST_TYPE_TO_CATEGORY[intent.requestType?.toLowerCase() || ''] || null,
    priorityId: REQUEST_TYPE_TO_PRIORITY[intent.requestType?.toLowerCase() || ''] || 3,
    description: intent.description || intent.summary || '',
    transcriptExcerpt: intent.transcriptExcerpt || '',
    confidence: intent.confidence || 0.5,
  }));

  // Ensure at least one intent exists
  if (intents.length === 0) {
    intents.push({
      intentNumber: 1,
      summary: raw.overallSummary || 'Call summary not available',
      requestType: 'general inquiry',
      categoryId: REQUEST_TYPE_TO_CATEGORY['general inquiry'],
      priorityId: REQUEST_TYPE_TO_PRIORITY['general inquiry'],
      description: raw.overallSummary || '',
      transcriptExcerpt: '',
      confidence: 0.5,
    });
  }

  return {
    intentCount: raw.intentCount || intents.length,
    intents,
    overallSummary: raw.overallSummary || '',
    customerName: raw.customerName || null,
    policyNumbers: raw.policyNumbers || [],
    phone: raw.phone || null,
    email: raw.email || null,
    address: raw.address || null,
    sentiment: validateSentiment(raw.sentiment),
    callType: raw.callType || null,
    callQuality: validateCallQuality(raw.callQuality),
    isHangup: raw.isHangup || false,
    actionItems: raw.actionItems || [],
  };
}

function validateSentiment(sentiment?: string): 'positive' | 'neutral' | 'negative' {
  if (sentiment === 'positive' || sentiment === 'negative') {
    return sentiment;
  }
  return 'neutral';
}

function validateCallQuality(
  quality?: string
): 'meaningful_conversation' | 'voicemail' | 'brief_no_service' {
  if (quality === 'voicemail' || quality === 'brief_no_service') {
    return quality;
  }
  return 'meaningful_conversation';
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

/**
 * Convert EnhancedExtractionResult back to the original AIAnalysis format
 * for backwards compatibility with existing code
 */
export interface LegacyAIAnalysis {
  summary: string;
  actionItems: string[];
  extractedData: {
    customerName?: string;
    policyNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
    vin?: string;
    effectiveDate?: string;
    amount?: string;
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  isHangup: boolean;
  callType?: string;
  serviceRequestType?: string;
  callQuality?: 'voicemail' | 'brief_no_service' | 'normal';
}

export function toLegacyFormat(enhanced: EnhancedExtractionResult): LegacyAIAnalysis {
  const primaryIntent = enhanced.intents[0];

  return {
    summary: enhanced.overallSummary,
    actionItems: enhanced.actionItems,
    extractedData: {
      customerName: enhanced.customerName || undefined,
      policyNumber: enhanced.policyNumbers[0] || undefined,
      phone: enhanced.phone || undefined,
      email: enhanced.email || undefined,
      address: enhanced.address || undefined,
    },
    sentiment: enhanced.sentiment,
    isHangup: enhanced.isHangup,
    callType: enhanced.callType || undefined,
    serviceRequestType: primaryIntent?.requestType || undefined,
    callQuality: enhanced.callQuality === 'meaningful_conversation'
      ? 'normal'
      : enhanced.callQuality,
  };
}
