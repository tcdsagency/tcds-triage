/**
 * Note Extractor
 * ==============
 * Extracts personal context from customer notes using Claude AI.
 * This enables personalized interactions that make agents feel like
 * they've known the customer for years.
 */

import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthorizedContact {
  name: string;
  relationship: string;
  canMakeChanges: boolean;
  notes?: string;
}

export interface FamilyMember {
  name: string;
  relationship: string;
  relevantInfo?: string;
  onPolicy: boolean;
}

export interface LifeEvent {
  event: string;
  date?: string;
  insuranceImplication?: string;
  mentionedOn: string;
}

export interface PendingItem {
  description: string;
  dueDate?: string;
  assignedTo?: string;
  status: 'pending' | 'in-progress' | 'waiting-on-customer';
  context?: string;
}

export interface InsurancePreference {
  preference: string;
  context?: string;
}

export interface PersonalContext {
  // Name & Identity
  preferredName?: string;
  pronunciation?: string;

  // Communication Preferences
  communicationPrefs: string[];
  bestContactTime?: string;
  bestContactMethod?: string;
  language?: string;

  // Relationships & Authorization
  authorizedContacts: AuthorizedContact[];
  familyMembers: FamilyMember[];

  // Life Context
  occupation?: string;
  employer?: string;
  lifeEvents: LifeEvent[];

  // Insurance Context
  recentTopics: string[];
  pendingItems: PendingItem[];
  preferences: InsurancePreference[];
  concerns: string[];

  // Relationship Quality
  sentiment: 'positive' | 'neutral' | 'at-risk';
  loyaltyIndicators: string[];
  painPoints: string[];

  // Conversation Starters
  personalInterests: string[];
  smallTalkTopics: string[];
}

// =============================================================================
// EXTRACTION PROMPT
// =============================================================================

const EXTRACTION_PROMPT = `You are an expert at analyzing insurance agency customer notes to extract personal context that helps agents provide personalized service.

Analyze the following customer notes and extract ALL personal details that would help an agent:
1. Build rapport and make the customer feel valued
2. Reference past conversations naturally
3. Follow up on pending items
4. Understand communication preferences
5. Know who is authorized on the account

Return a JSON object with this exact structure (use null for unknown fields, empty arrays for no items):

{
  "preferredName": "nickname or preferred name if mentioned",
  "pronunciation": "pronunciation guide if noted",
  "communicationPrefs": ["list of communication needs like 'Hard of hearing', 'Prefers text'"],
  "bestContactTime": "when to call if mentioned",
  "bestContactMethod": "preferred contact method",
  "language": "primary language if not English",
  "authorizedContacts": [
    {
      "name": "person name",
      "relationship": "Wife/Husband/Son/etc",
      "canMakeChanges": true/false,
      "notes": "any relevant notes about this person"
    }
  ],
  "familyMembers": [
    {
      "name": "member name",
      "relationship": "relationship",
      "relevantInfo": "relevant info like 'just got license'",
      "onPolicy": true/false
    }
  ],
  "lifeEvents": [
    {
      "event": "what happened or is happening",
      "date": "when if mentioned",
      "insuranceImplication": "how this might affect their insurance",
      "mentionedOn": "date note was posted"
    }
  ],
  "recentTopics": ["list of topics they've called about recently"],
  "pendingItems": [
    {
      "description": "what needs to be done",
      "dueDate": "if mentioned",
      "assignedTo": "who was handling it",
      "status": "pending|in-progress|waiting-on-customer",
      "context": "additional context"
    }
  ],
  "preferences": [
    {
      "preference": "stated preference",
      "context": "why or when mentioned"
    }
  ],
  "concerns": ["any worries or concerns they've expressed"],
  "sentiment": "positive|neutral|at-risk based on overall tone of notes",
  "loyaltyIndicators": ["things that show loyalty like 'referred 3 friends'"],
  "painPoints": ["any complaints or frustrations mentioned"],
  "personalInterests": ["hobbies, sports teams, interests mentioned"],
  "smallTalkTopics": ["safe topics for building rapport"]
}

Important:
- Extract EVERYTHING relevant, even small details
- For pendingItems, look for action items, follow-ups, quotes requested
- For lifeEvents, look for weddings, births, moves, new jobs, retirements
- For communicationPrefs, note any special needs or preferences
- Be conservative with sentiment - only mark "at-risk" if there are clear complaints
- Return ONLY valid JSON, no markdown or explanation`;

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Extract personal context from customer notes using Claude AI
 *
 * @param notes - Array of note strings (raw note content)
 * @param options - Optional configuration
 * @returns PersonalContext object with extracted information
 */
export async function extractPersonalContext(
  notes: string[],
  options?: {
    maxNotes?: number;
    apiKey?: string;
  }
): Promise<PersonalContext> {
  const maxNotes = options?.maxNotes ?? 20;
  const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;

  // Return empty context if no notes
  if (!notes || notes.length === 0) {
    return getEmptyContext();
  }

  // Return empty context if no API key
  if (!apiKey) {
    console.warn('[NoteExtractor] No ANTHROPIC_API_KEY configured');
    return getEmptyContext();
  }

  // Take the most recent notes (they're usually most relevant)
  const recentNotes = notes.slice(0, maxNotes);

  // Combine notes into a single text block with separators
  const notesText = recentNotes
    .map((note, i) => `--- Note ${i + 1} ---\n${note}`)
    .join('\n\n');

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract personal context from these customer notes:\n\n${notesText}`,
        },
      ],
    });

    // Extract text from response
    const content = response.content[0];
    if (content.type !== 'text') {
      console.warn('[NoteExtractor] Unexpected response type');
      return getEmptyContext();
    }

    // Parse JSON response
    let jsonStr = content.text.trim();

    // Handle potential markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the response
    return normalizeContext(parsed);
  } catch (err) {
    console.error('[NoteExtractor] Error extracting context:', err);
    return getEmptyContext();
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Return an empty PersonalContext object
 */
function getEmptyContext(): PersonalContext {
  return {
    preferredName: undefined,
    pronunciation: undefined,
    communicationPrefs: [],
    bestContactTime: undefined,
    bestContactMethod: undefined,
    language: undefined,
    authorizedContacts: [],
    familyMembers: [],
    lifeEvents: [],
    recentTopics: [],
    pendingItems: [],
    preferences: [],
    concerns: [],
    sentiment: 'neutral',
    loyaltyIndicators: [],
    painPoints: [],
    personalInterests: [],
    smallTalkTopics: [],
  };
}

/**
 * Normalize and validate the parsed context
 */
function normalizeContext(parsed: Record<string, unknown>): PersonalContext {
  return {
    preferredName: typeof parsed.preferredName === 'string' ? parsed.preferredName : undefined,
    pronunciation: typeof parsed.pronunciation === 'string' ? parsed.pronunciation : undefined,
    communicationPrefs: Array.isArray(parsed.communicationPrefs)
      ? parsed.communicationPrefs.filter((p): p is string => typeof p === 'string')
      : [],
    bestContactTime: typeof parsed.bestContactTime === 'string' ? parsed.bestContactTime : undefined,
    bestContactMethod: typeof parsed.bestContactMethod === 'string' ? parsed.bestContactMethod : undefined,
    language: typeof parsed.language === 'string' ? parsed.language : undefined,
    authorizedContacts: normalizeAuthorizedContacts(parsed.authorizedContacts),
    familyMembers: normalizeFamilyMembers(parsed.familyMembers),
    lifeEvents: normalizeLifeEvents(parsed.lifeEvents),
    recentTopics: Array.isArray(parsed.recentTopics)
      ? parsed.recentTopics.filter((t): t is string => typeof t === 'string')
      : [],
    pendingItems: normalizePendingItems(parsed.pendingItems),
    preferences: normalizePreferences(parsed.preferences),
    concerns: Array.isArray(parsed.concerns)
      ? parsed.concerns.filter((c): c is string => typeof c === 'string')
      : [],
    sentiment: normalizeSentiment(parsed.sentiment),
    loyaltyIndicators: Array.isArray(parsed.loyaltyIndicators)
      ? parsed.loyaltyIndicators.filter((l): l is string => typeof l === 'string')
      : [],
    painPoints: Array.isArray(parsed.painPoints)
      ? parsed.painPoints.filter((p): p is string => typeof p === 'string')
      : [],
    personalInterests: Array.isArray(parsed.personalInterests)
      ? parsed.personalInterests.filter((i): i is string => typeof i === 'string')
      : [],
    smallTalkTopics: Array.isArray(parsed.smallTalkTopics)
      ? parsed.smallTalkTopics.filter((t): t is string => typeof t === 'string')
      : [],
  };
}

function normalizeAuthorizedContacts(contacts: unknown): AuthorizedContact[] {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => ({
      name: typeof c.name === 'string' ? c.name : 'Unknown',
      relationship: typeof c.relationship === 'string' ? c.relationship : 'Unknown',
      canMakeChanges: c.canMakeChanges === true,
      notes: typeof c.notes === 'string' ? c.notes : undefined,
    }));
}

function normalizeFamilyMembers(members: unknown): FamilyMember[] {
  if (!Array.isArray(members)) return [];
  return members
    .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
    .map((m) => ({
      name: typeof m.name === 'string' ? m.name : 'Unknown',
      relationship: typeof m.relationship === 'string' ? m.relationship : 'Unknown',
      relevantInfo: typeof m.relevantInfo === 'string' ? m.relevantInfo : undefined,
      onPolicy: m.onPolicy === true,
    }));
}

function normalizeLifeEvents(events: unknown): LifeEvent[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map((e) => ({
      event: typeof e.event === 'string' ? e.event : 'Unknown event',
      date: typeof e.date === 'string' ? e.date : undefined,
      insuranceImplication: typeof e.insuranceImplication === 'string' ? e.insuranceImplication : undefined,
      mentionedOn: typeof e.mentionedOn === 'string' ? e.mentionedOn : 'Unknown',
    }));
}

function normalizePendingItems(items: unknown): PendingItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .map((i) => ({
      description: typeof i.description === 'string' ? i.description : 'Unknown item',
      dueDate: typeof i.dueDate === 'string' ? i.dueDate : undefined,
      assignedTo: typeof i.assignedTo === 'string' ? i.assignedTo : undefined,
      status: normalizeStatus(i.status),
      context: typeof i.context === 'string' ? i.context : undefined,
    }));
}

function normalizeStatus(status: unknown): PendingItem['status'] {
  if (status === 'in-progress') return 'in-progress';
  if (status === 'waiting-on-customer') return 'waiting-on-customer';
  return 'pending';
}

function normalizePreferences(prefs: unknown): InsurancePreference[] {
  if (!Array.isArray(prefs)) return [];
  return prefs
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => ({
      preference: typeof p.preference === 'string' ? p.preference : 'Unknown',
      context: typeof p.context === 'string' ? p.context : undefined,
    }));
}

function normalizeSentiment(sentiment: unknown): PersonalContext['sentiment'] {
  if (sentiment === 'positive') return 'positive';
  if (sentiment === 'at-risk') return 'at-risk';
  return 'neutral';
}
