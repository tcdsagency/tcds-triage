/**
 * Light AI Extraction
 * Takes 3CX transcript + summary and extracts structured fields via GPT-4o-mini.
 * This replaces the heavy AI extraction in the old transcript-worker.
 */

import OpenAI from 'openai';

// =============================================================================
// Types
// =============================================================================

export interface LightExtractionInput {
  transcript: string;
  summary: string;
  sentimentScore: number; // 3CX 1-5 scale
  direction: 'inbound' | 'outbound';
  agentExtension?: string;
  callerNumber?: string;
  durationSeconds?: number;
}

export interface LightExtractionResult {
  customerName: string | null;
  policyNumbers: string[];
  insuranceType: 'auto' | 'home' | 'life' | 'commercial' | 'toys' | 'unknown';
  requestType: 'new_quote' | 'policy_change' | 'claim' | 'billing' | 'general' | 'hangup';
  enhancedSummary: string;
  actionItems: string[];
  topics: string[];
  isHangup: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
}

// =============================================================================
// Sentiment Mapping
// =============================================================================

/**
 * Map 3CX 1-5 sentiment scale to our positive/neutral/negative.
 * 4-5 = positive, 3 = neutral, 1-2 = negative
 */
export function mapSentiment(score: number): 'positive' | 'neutral' | 'negative' {
  if (score >= 4) return 'positive';
  if (score >= 3) return 'neutral';
  return 'negative';
}

// =============================================================================
// Hangup Detection (carried forward from transcript-worker)
// =============================================================================

const AUTO_ATTENDANT_PHRASES = [
  'thank you for calling',
  'press 1 for', 'press 2 for',
  'please hold',
  'your call is important',
  'all agents are busy',
];

const REAL_CONVERSATION_PHRASES = [
  'hello', 'how can i help', 'my name is',
];

const VOICEMAIL_INDICATORS = [
  'left a voicemail', 'left a voice mail',
  'voicemail was left', 'went to voicemail', 'reached voicemail',
  'mailbox is full',
  'not available', 'no answer',
  'agent left a message', 'left a message for', 'left a message regarding', 'left a message about',
];

/**
 * Detect if a call is a hangup/no-content call that should be auto-voided.
 */
export function detectHangup(input: {
  transcript: string;
  summary: string;
  durationSeconds?: number;
  callerNumber?: string;
}): { isHangup: boolean; reason: string | null } {
  const { transcript, summary, durationSeconds, callerNumber } = input;
  const lower = (transcript || '').toLowerCase();
  const summaryLower = (summary || '').toLowerCase();

  // Short call with no real conversation
  if (durationSeconds !== undefined && durationSeconds < 35) {
    // Check if it's auto-attendant only
    const hasAutoAttendant = AUTO_ATTENDANT_PHRASES.some(p => lower.includes(p));
    const hasRealConversation = REAL_CONVERSATION_PHRASES.some(p => lower.includes(p));
    if (!hasRealConversation || hasAutoAttendant) {
      return { isHangup: true, reason: 'short_call' };
    }
  }

  // PlayFile/test calls
  if (callerNumber === 'PlayFile' || (callerNumber || '').toLowerCase().includes('playfile')) {
    return { isHangup: true, reason: 'playfile' };
  }

  // No content
  if (!summary || summary.length < 15) {
    if (!transcript || transcript.length < 20) {
      return { isHangup: true, reason: 'no_content' };
    }
  }

  // Voicemail indicators in summary
  for (const indicator of VOICEMAIL_INDICATORS) {
    if (summaryLower.includes(indicator) || lower.includes(indicator)) {
      return { isHangup: true, reason: 'voicemail' };
    }
  }

  return { isHangup: false, reason: null };
}

// =============================================================================
// Policy Number Extraction (regex)
// =============================================================================

const POLICY_REGEX = /\b(?:policy|pol|#)\s*(?:number|num|no\.?|#)?\s*[:.]?\s*([A-Z0-9]{5,20}(?:[-][A-Z0-9]+)*)\b/gi;

function extractPolicyNumbers(text: string): string[] {
  const matches: string[] = [];
  let match;
  while ((match = POLICY_REGEX.exec(text)) !== null) {
    const num = match[1].trim();
    if (num.length >= 5 && !matches.includes(num)) {
      matches.push(num);
    }
  }
  return matches;
}

// =============================================================================
// AI Extraction
// =============================================================================

const EXTRACTION_PROMPT = `You are an insurance agency call data extractor. Given a call transcript and summary from a 3CX phone system, extract structured data.

IMPORTANT: Extract data only. Do NOT rewrite the summary unless it is missing critical information (caller name, request type, or policy number mentioned in transcript but absent from summary).

Return JSON with these fields:
- customerName: string | null — The caller's name if mentioned
- policyNumbers: string[] — Any policy numbers mentioned (format: alphanumeric, 5-20 chars)
- insuranceType: "auto" | "home" | "life" | "commercial" | "toys" | "unknown" — Primary insurance type discussed. "toys" = boats, RVs, motorcycles, ATVs
- requestType: "new_quote" | "policy_change" | "claim" | "billing" | "general" | "hangup" — Primary reason for the call
- enhancedSummary: string — The original 3CX summary, refined ONLY if missing critical info from the transcript
- actionItems: string[] — Specific follow-up actions needed (max 5)
- topics: string[] — Key topics discussed (max 5, e.g., "auto policy", "rate increase", "add driver")
- isHangup: boolean — true if this appears to be a hangup, wrong number, or no real conversation`;

export async function extractCallData(input: LightExtractionInput): Promise<LightExtractionResult> {
  // Pre-extract policy numbers via regex
  const regexPolicies = extractPolicyNumbers(input.transcript);

  // Detect hangup before calling AI
  const hangupCheck = detectHangup({
    transcript: input.transcript,
    summary: input.summary,
    durationSeconds: input.durationSeconds,
    callerNumber: input.callerNumber,
  });

  // For obvious hangups, skip AI call
  if (hangupCheck.isHangup) {
    return {
      customerName: null,
      policyNumbers: regexPolicies,
      insuranceType: 'unknown',
      requestType: 'hangup',
      enhancedSummary: input.summary || 'Hangup / no conversation',
      actionItems: [],
      topics: [],
      isHangup: true,
      sentiment: mapSentiment(input.sentimentScore),
    };
  }

  // For very short transcripts, also skip AI
  if (!input.transcript || input.transcript.length < 30) {
    return {
      customerName: null,
      policyNumbers: regexPolicies,
      insuranceType: 'unknown',
      requestType: 'general',
      enhancedSummary: input.summary || 'Short call with minimal content',
      actionItems: [],
      topics: [],
      isHangup: false,
      sentiment: mapSentiment(input.sentimentScore),
    };
  }

  try {
    const openai = new OpenAI();

    const userMessage = [
      `Direction: ${input.direction}`,
      input.agentExtension ? `Agent Extension: ${input.agentExtension}` : '',
      input.callerNumber ? `Caller Number: ${input.callerNumber}` : '',
      input.durationSeconds !== undefined ? `Duration: ${input.durationSeconds}s` : '',
      '',
      '--- 3CX SUMMARY ---',
      input.summary || '(no summary available)',
      '',
      '--- TRANSCRIPT ---',
      input.transcript.slice(0, 6000), // Cap at 6000 chars for cost
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty AI response');

    const parsed = JSON.parse(raw);

    // Merge regex-extracted policy numbers with AI-extracted
    const allPolicies = [...new Set([
      ...(parsed.policyNumbers || []),
      ...regexPolicies,
    ])];

    return {
      customerName: parsed.customerName || null,
      policyNumbers: allPolicies,
      insuranceType: parsed.insuranceType || 'unknown',
      requestType: parsed.requestType || 'general',
      enhancedSummary: parsed.enhancedSummary || input.summary,
      actionItems: (parsed.actionItems || []).slice(0, 5),
      topics: (parsed.topics || []).slice(0, 5),
      isHangup: parsed.isHangup === true,
      sentiment: mapSentiment(input.sentimentScore),
    };
  } catch (error) {
    console.error('[light-extraction] AI extraction failed, using fallback:', error);

    // Fallback: return what we can without AI
    return {
      customerName: null,
      policyNumbers: regexPolicies,
      insuranceType: 'unknown',
      requestType: 'general',
      enhancedSummary: input.summary || '',
      actionItems: [],
      topics: [],
      isHangup: false,
      sentiment: mapSentiment(input.sentimentScore),
    };
  }
}
