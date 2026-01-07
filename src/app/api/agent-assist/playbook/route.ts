// API Route: /api/agent-assist/playbook
// Match transcript to appropriate playbook

import { NextRequest, NextResponse } from 'next/server';
import { PLAYBOOKS, PLAYBOOKS_BY_ID } from '@/lib/agent-assist/playbooks';
import type { PlaybookMatchRequest, PlaybookMatchResponse, Playbook } from '@/lib/agent-assist/types';

// Filler words to ignore during matching
const FILLER_WORDS = new Set([
  'um', 'uh', 'like', 'you know', 'so', 'well', 'i mean', 'actually',
  'basically', 'literally', 'just', 'really', 'very', 'the', 'a', 'an',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
  'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'than', 'too', 'very', 's', 't', 'can', 'will',
  'just', 'don', 'should', 'now', 'd', 'll', 'm', 'o', 're', 've', 'y', 'ain',
  'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven', 'isn', 'ma',
  'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn', 'weren', 'won', 'wouldn',
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
  'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs',
  'themselves', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'about', 'against',
]);

// Normalize text for matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract meaningful words from text
function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized
    .split(' ')
    .filter(word => word.length > 2 && !FILLER_WORDS.has(word));
}

// Score a playbook against transcript
function scorePlaybook(playbook: Playbook, transcript: string, keywords: string[]): { score: number; matchedTriggers: string[] } {
  let score = 0;
  const matchedTriggers: string[] = [];
  const normalizedTranscript = normalizeText(transcript);

  for (const trigger of playbook.triggers) {
    const normalizedTrigger = normalizeText(trigger);
    
    // Check for exact phrase match (higher weight)
    if (normalizedTranscript.includes(normalizedTrigger)) {
      score += 3;
      matchedTriggers.push(trigger);
      continue;
    }
    
    // Check for word-by-word match
    const triggerWords = normalizedTrigger.split(' ');
    const matchedWords = triggerWords.filter(word => 
      keywords.includes(word) || normalizedTranscript.includes(word)
    );
    
    if (matchedWords.length === triggerWords.length) {
      score += 2;
      matchedTriggers.push(trigger);
    } else if (matchedWords.length > 0) {
      score += matchedWords.length / triggerWords.length;
      if (matchedWords.length / triggerWords.length >= 0.5) {
        matchedTriggers.push(trigger);
      }
    }
  }

  // Normalize score by number of triggers
  const normalizedScore = score / (playbook.triggers.length * 3);

  return { score: normalizedScore, matchedTriggers };
}

// Match transcript to best playbook
function matchPlaybook(transcript: string, callType?: string): PlaybookMatchResponse {
  if (!transcript || transcript.trim().length < 10) {
    return {
      success: true,
      playbook: null,
      confidence: 0,
      matchedTriggers: [],
    };
  }

  const keywords = extractKeywords(transcript);
  
  let bestPlaybook: Playbook | null = null;
  let bestScore = 0;
  let bestMatchedTriggers: string[] = [];

  // Filter playbooks by call type if provided
  let candidates = PLAYBOOKS;
  if (callType) {
    const domainMap: Record<string, string> = {
      'billing': 'billing_payments',
      'payment': 'billing_payments',
      'quote': 'new_business',
      'new': 'new_business',
      'renewal': 'renewals',
      'claim': 'claims',
      'change': 'policy_changes',
      'endorsement': 'policy_changes',
    };
    const domain = domainMap[callType.toLowerCase()];
    if (domain) {
      candidates = PLAYBOOKS.filter(p => p.domain === domain);
    }
  }

  // Score each playbook
  for (const playbook of candidates) {
    const { score, matchedTriggers } = scorePlaybook(playbook, transcript, keywords);
    
    if (score > bestScore) {
      bestScore = score;
      bestPlaybook = playbook;
      bestMatchedTriggers = matchedTriggers;
    }
  }

  // Only return playbook if confidence is above threshold
  const CONFIDENCE_THRESHOLD = 0.15;
  
  if (bestScore < CONFIDENCE_THRESHOLD) {
    return {
      success: true,
      playbook: null,
      confidence: bestScore,
      matchedTriggers: bestMatchedTriggers,
    };
  }

  return {
    success: true,
    playbook: bestPlaybook,
    confidence: Math.min(bestScore, 1),
    matchedTriggers: bestMatchedTriggers,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: PlaybookMatchRequest = await request.json();

    if (!body.transcript) {
      return NextResponse.json(
        { success: false, error: 'Transcript is required' },
        { status: 400 }
      );
    }

    // Take last 2000 characters for matching
    const transcript = body.transcript.slice(-2000);
    
    const result = matchPlaybook(transcript, body.callType);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Agent Assist] Playbook match error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to match playbook', details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve a specific playbook by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const domain = searchParams.get('domain');

    if (id) {
      const playbook = PLAYBOOKS_BY_ID[id];
      if (!playbook) {
        return NextResponse.json(
          { success: false, error: 'Playbook not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, playbook });
    }

    if (domain) {
      const playbooks = PLAYBOOKS.filter(p => p.domain === domain);
      return NextResponse.json({ success: true, playbooks });
    }

    // Return all playbooks
    return NextResponse.json({ success: true, playbooks: PLAYBOOKS });
  } catch (error: any) {
    console.error('[Agent Assist] Playbook fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch playbook', details: error.message },
      { status: 500 }
    );
  }
}
