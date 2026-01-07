// API Route: /api/agent-assist/playbook
// Match call transcript to most relevant playbook

import { NextRequest, NextResponse } from "next/server";
import { ALL_PLAYBOOKS, getPlaybookById } from "@/lib/agent-assist/playbooks";
import { Playbook, PlaybookMatchRequest, PlaybookMatchResponse } from "@/lib/agent-assist/types";

// Filler words to remove from transcript before matching
const FILLER_WORDS = new Set([
  'um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally',
  'i mean', 'so', 'well', 'right', 'okay', 'yeah', 'yep', 'hmm', 'ah',
  'er', 'um', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'than', 'too', 'very', 'just', 'but', 'and', 'if', 'or', 'because',
  'until', 'while', 'this', 'that', 'these', 'those', 'am', 'it', 'its',
  'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'your', 'yours',
  'he', 'him', 'his', 'she', 'her', 'hers', 'we', 'us', 'our', 'ours',
  'i', 'me', 'my', 'mine', 'you',
]);

// Normalize transcript for matching
function normalizeTranscript(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => !FILLER_WORDS.has(word) && word.length > 1)
    .join(' ');
}

// Score a playbook against the transcript
function scorePlaybook(playbook: Playbook, normalizedTranscript: string): { score: number; matchedTriggers: string[] } {
  const matchedTriggers: string[] = [];
  let score = 0;

  for (const trigger of playbook.triggerKeywords) {
    const normalizedTrigger = trigger.toLowerCase();

    // Check for exact phrase match (higher weight)
    if (normalizedTranscript.includes(normalizedTrigger)) {
      matchedTriggers.push(trigger);
      // Longer phrases get higher scores
      score += normalizedTrigger.split(' ').length * 2;
    } else {
      // Check for individual word matches (lower weight)
      const triggerWords = normalizedTrigger.split(' ');
      const matchedWords = triggerWords.filter(word =>
        normalizedTranscript.includes(word) && word.length > 2
      );

      if (matchedWords.length > 0) {
        score += matchedWords.length * 0.5;
      }
    }
  }

  // Normalize score based on number of triggers
  const normalizedScore = matchedTriggers.length > 0
    ? score / playbook.triggerKeywords.length
    : 0;

  return { score: normalizedScore, matchedTriggers };
}

// POST - Match transcript to playbook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PlaybookMatchRequest;
    const { transcript, callType } = body;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json<PlaybookMatchResponse>({
        success: false,
        playbook: null,
        confidence: 0,
        matchedTriggers: [],
        error: "Transcript is required",
      }, { status: 400 });
    }

    // Take last 2000 characters for matching (most recent context)
    const recentTranscript = transcript.slice(-2000);
    const normalizedTranscript = normalizeTranscript(recentTranscript);

    // Score all playbooks
    const scores = ALL_PLAYBOOKS.map(playbook => {
      const { score, matchedTriggers } = scorePlaybook(playbook, normalizedTranscript);

      // Boost score if callType hint matches domain
      let adjustedScore = score;
      if (callType) {
        const typeToDomin: Record<string, string[]> = {
          'billing': ['billing_payments'],
          'payment': ['billing_payments'],
          'quote': ['new_business'],
          'new_business': ['new_business'],
          'renewal': ['renewals'],
          'claim': ['claims'],
          'policy_change': ['policy_changes'],
          'service': ['policy_changes'],
          'complaint': ['escalations'],
          'escalation': ['escalations'],
        };

        const hintDomains = typeToDomin[callType.toLowerCase()] || [];
        if (hintDomains.includes(playbook.domain)) {
          adjustedScore *= 1.5; // 50% boost for matching call type
        }
      }

      return {
        playbook,
        score: adjustedScore,
        matchedTriggers,
      };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Get best match
    const bestMatch = scores[0];
    const minConfidenceThreshold = 0.3;

    // Calculate confidence (0-1 scale)
    // Max theoretical score depends on playbook with most triggers matching
    const maxPossibleScore = 10; // Approximate max normalized score
    const confidence = Math.min(bestMatch.score / maxPossibleScore, 1);

    if (confidence < minConfidenceThreshold || bestMatch.matchedTriggers.length === 0) {
      return NextResponse.json<PlaybookMatchResponse>({
        success: true,
        playbook: null,
        confidence: 0,
        matchedTriggers: [],
      });
    }

    return NextResponse.json<PlaybookMatchResponse>({
      success: true,
      playbook: bestMatch.playbook,
      confidence: Math.round(confidence * 100) / 100,
      matchedTriggers: bestMatch.matchedTriggers,
    });

  } catch (error: any) {
    console.error("[Agent Assist] Playbook match error:", error);
    return NextResponse.json<PlaybookMatchResponse>({
      success: false,
      playbook: null,
      confidence: 0,
      matchedTriggers: [],
      error: error.message || "Failed to match playbook",
    }, { status: 500 });
  }
}

// GET - Get a specific playbook by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      // Return all playbooks
      return NextResponse.json({
        success: true,
        playbooks: ALL_PLAYBOOKS,
      });
    }

    const playbook = getPlaybookById(id);

    if (!playbook) {
      return NextResponse.json({
        success: false,
        error: "Playbook not found",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      playbook,
    });

  } catch (error: any) {
    console.error("[Agent Assist] Get playbook error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to get playbook",
    }, { status: 500 });
  }
}
