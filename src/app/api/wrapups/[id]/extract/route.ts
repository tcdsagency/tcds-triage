/**
 * Service Request Extraction API
 * ===============================
 * Extracts and caches AI-powered field suggestions for service ticket auto-fill.
 *
 * GET /api/wrapups/[id]/extract - Get extraction with confidence scores
 *   ?refresh=true - Force re-extraction (bypass cache)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  wrapupDrafts,
  calls,
  liveTranscriptSegments,
  serviceRequestExtractions
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
} from '@/lib/api/agencyzoom-service-tickets';

// =============================================================================
// TYPES
// =============================================================================

interface ExtractionResult {
  summary: { value: string; confidence: number; source: 'ai' | 'keyword' | 'default' };
  category: { value: { id: number; name: string } | null; confidence: number };
  priority: { value: { id: number; name: string } | null; confidence: number };
  description: { value: string; confidence: number };
  requestType: string | null;
  urgency: string | null;
  actionItems: string[];
  extractedAt: string;
  extractionVersion: number;
  cached: boolean;
}

// Category name lookup
// Note: Some categories share IDs (GENERAL_SERVICE=SERVICE_QUESTION=37345, WRONG_NUMBER_HANGUP=QUOTE_REQUEST=115762)
const CATEGORY_NAME_MAP: Record<number, string> = {};
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.GENERAL_SERVICE] = 'General Service';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.WRONG_NUMBER_HANGUP] = 'Wrong Number / Quote';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.CLAIMS_FILED] = 'Claims - Filed';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.CLAIMS_NOT_FILED] = 'Claims - Not Filed';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.CLAIMS_STATUS] = 'Claims - Status';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.CLAIMS_PAYMENT] = 'Claims - Payment';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.CLAIMS_CONSULT] = 'Claims - Consult';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_DRIVER] = '+/- Driver';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_VEHICLE] = '+/- Vehicle';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_PROPERTY] = '+/- Property';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_INSURED] = '+/- Insured';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_LIENHOLDER] = '+/- Lienholder';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE] = 'Coverage Change';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS] = 'Billing Question';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS] = 'Billing Payment';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_BILLING_CHANGES] = 'Billing Changes';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_ID_CARDS] = 'ID Cards';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_COI] = 'Certificate of Insurance';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_LOSS_RUN] = 'Loss Run';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING] = 'Client Cancelling';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_PENDING_CANCELLATION] = 'Pending Cancellation';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_CARRIER_REQUEST] = 'Carrier Request';
CATEGORY_NAME_MAP[SERVICE_CATEGORIES.SERVICE_REMARKET] = 'Remarket';

// Priority name lookup
const PRIORITY_NAME_MAP: Record<number, string> = {
  [SERVICE_PRIORITIES.URGENT]: 'Urgent',
  [SERVICE_PRIORITIES.TWO_HOUR]: '2 Hour',
  [SERVICE_PRIORITIES.STANDARD]: 'Standard',
};

// =============================================================================
// KEYWORD DETECTION (matches CreateServiceTicketModal patterns)
// =============================================================================

const CATEGORY_KEYWORDS: { category: number; keywords: string[]; confidence: number }[] = [
  // High confidence matches
  { category: SERVICE_CATEGORIES.CLAIMS_NOT_FILED, keywords: ['accident', 'crash', 'collision', 'hit', 'damage', 'totaled', 'theft', 'stolen', 'vandal'], confidence: 0.85 },
  { category: SERVICE_CATEGORIES.CLAIMS_STATUS, keywords: ['claim status', 'claim question', 'filed claim', 'my claim', 'claim update'], confidence: 0.90 },
  { category: SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING, keywords: ['cancel', 'cancellation', 'stop', 'end policy', 'terminate', 'not renewing'], confidence: 0.85 },
  { category: SERVICE_CATEGORIES.SERVICE_VEHICLE, keywords: ['add vehicle', 'remove vehicle', 'new car', 'sold car', 'bought a', 'traded', 'replace vehicle'], confidence: 0.88 },
  { category: SERVICE_CATEGORIES.SERVICE_DRIVER, keywords: ['add driver', 'remove driver', 'new driver', 'exclude driver', 'licensed', 'teenager'], confidence: 0.88 },
  { category: SERVICE_CATEGORIES.SERVICE_ID_CARDS, keywords: ['id card', 'insurance card', 'proof of insurance', 'print card'], confidence: 0.92 },
  { category: SERVICE_CATEGORIES.SERVICE_COI, keywords: ['certificate', 'cert', 'coi', 'proof', 'additional insured', 'acord'], confidence: 0.90 },
  // Medium confidence matches
  { category: SERVICE_CATEGORIES.QUOTE_REQUEST, keywords: ['quote', 'price', 'cost', 'rate', 'bundle', 'new policy', 'shopping'], confidence: 0.75 },
  { category: SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS, keywords: ['payment', 'pay', 'paid', 'autopay', 'bank draft'], confidence: 0.78 },
  { category: SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS, keywords: ['bill', 'invoice', 'charge', 'billing question', 'why did my'], confidence: 0.75 },
  { category: SERVICE_CATEGORIES.SERVICE_PROPERTY, keywords: ['add property', 'remove property', 'new home', 'sold home', 'rental property', 'address change', 'moved'], confidence: 0.80 },
  { category: SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE, keywords: ['coverage', 'deductible', 'limit', 'increase coverage', 'decrease coverage', 'endorsement'], confidence: 0.78 },
  // Lower confidence fallbacks
  { category: SERVICE_CATEGORIES.SERVICE_QUESTION, keywords: ['question', 'does my policy', 'what does', 'covered', 'explain'], confidence: 0.65 },
  { category: SERVICE_CATEGORIES.WRONG_NUMBER_HANGUP, keywords: ['wrong number', 'hangup', 'hung up', 'disconnected', 'dropped call'], confidence: 0.95 },
];

const HIGH_PRIORITY_KEYWORDS = ['urgent', 'emergency', 'asap', 'immediately', 'right now', 'accident', 'crash', 'critical'];
const MEDIUM_PRIORITY_KEYWORDS = ['soon', 'this week', 'when you can', 'at your earliest'];

function detectCategory(text: string): { categoryId: number; confidence: number } | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  for (const { category, keywords, confidence } of CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return { categoryId: category, confidence };
      }
    }
  }
  return null;
}

function detectPriority(text: string, urgency?: string | null): { priorityId: number; confidence: number } {
  // First check explicit urgency field
  if (urgency) {
    const u = urgency.toLowerCase();
    if (u === 'urgent' || u === 'high') return { priorityId: SERVICE_PRIORITIES.URGENT, confidence: 0.95 };
    if (u === 'medium') return { priorityId: SERVICE_PRIORITIES.TWO_HOUR, confidence: 0.85 };
  }

  // Then check text for keywords
  if (text) {
    const lowerText = text.toLowerCase();
    for (const keyword of HIGH_PRIORITY_KEYWORDS) {
      if (lowerText.includes(keyword)) return { priorityId: SERVICE_PRIORITIES.URGENT, confidence: 0.80 };
    }
    for (const keyword of MEDIUM_PRIORITY_KEYWORDS) {
      if (lowerText.includes(keyword)) return { priorityId: SERVICE_PRIORITIES.TWO_HOUR, confidence: 0.70 };
    }
  }

  return { priorityId: SERVICE_PRIORITIES.STANDARD, confidence: 0.60 };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: wrapupId } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true';

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant not configured' },
        { status: 500 }
      );
    }

    // Get the wrapup draft with call data
    const [wrapup] = await db
      .select({
        id: wrapupDrafts.id,
        callId: wrapupDrafts.callId,
        summary: wrapupDrafts.summary,
        aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
        aiExtraction: wrapupDrafts.aiExtraction,
        requestType: wrapupDrafts.requestType,
        customerName: wrapupDrafts.customerName,
      })
      .from(wrapupDrafts)
      .where(and(eq(wrapupDrafts.id, wrapupId), eq(wrapupDrafts.tenantId, tenantId)))
      .limit(1);

    if (!wrapup) {
      return NextResponse.json(
        { success: false, error: 'Wrapup not found' },
        { status: 404 }
      );
    }

    // Check for cached extraction (unless refresh requested)
    if (!refresh) {
      const [cached] = await db
        .select()
        .from(serviceRequestExtractions)
        .where(eq(serviceRequestExtractions.wrapupDraftId, wrapupId))
        .limit(1);

      if (cached) {
        const result: ExtractionResult = {
          summary: {
            value: cached.summary || '',
            confidence: cached.summaryConfidence || 0,
            source: 'ai',
          },
          category: cached.categoryId
            ? {
                value: { id: cached.categoryId, name: CATEGORY_NAME_MAP[cached.categoryId] || 'Unknown' },
                confidence: cached.categoryConfidence || 0,
              }
            : { value: null, confidence: 0 },
          priority: cached.priorityId
            ? {
                value: { id: cached.priorityId, name: PRIORITY_NAME_MAP[cached.priorityId] || 'Unknown' },
                confidence: cached.priorityConfidence || 0,
              }
            : { value: null, confidence: 0 },
          description: {
            value: cached.description || '',
            confidence: cached.descriptionConfidence || 0,
          },
          requestType: cached.requestType,
          urgency: cached.urgency,
          actionItems: (cached.actionItems as string[]) || [],
          extractedAt: cached.createdAt.toISOString(),
          extractionVersion: cached.extractionVersion,
          cached: true,
        };

        return NextResponse.json({ success: true, data: result });
      }
    }

    // Run extraction
    const aiExtraction = wrapup.aiExtraction as {
      summary?: string;
      actionItems?: string[];
      urgency?: string;
      extractedData?: {
        customerName?: string;
      };
    } | null;

    // Get transcript for analysis
    let transcriptText = '';
    if (wrapup.callId) {
      const segments = await db
        .select({ text: liveTranscriptSegments.text })
        .from(liveTranscriptSegments)
        .where(eq(liveTranscriptSegments.callId, wrapup.callId))
        .orderBy(liveTranscriptSegments.sequenceNumber);

      transcriptText = segments.map(s => s.text).join(' ');

      // Fallback to call transcription if no live segments
      if (!transcriptText) {
        const [call] = await db
          .select({ transcription: calls.transcription })
          .from(calls)
          .where(eq(calls.id, wrapup.callId))
          .limit(1);
        transcriptText = call?.transcription || '';
      }
    }

    // Combine all text sources for analysis
    const analysisText = [
      wrapup.requestType,
      wrapup.summary,
      wrapup.aiCleanedSummary,
      aiExtraction?.summary,
      transcriptText,
    ].filter(Boolean).join(' ');

    // Generate summary
    const summaryValue = wrapup.aiCleanedSummary || wrapup.summary || aiExtraction?.summary || '';
    const summaryConfidence = wrapup.aiCleanedSummary ? 0.85 : (wrapup.summary ? 0.75 : 0.50);

    // Detect category
    const categoryResult = detectCategory(analysisText);
    const categoryId = categoryResult?.categoryId || SERVICE_CATEGORIES.GENERAL_SERVICE;
    const categoryConfidence = categoryResult?.confidence || 0.40;

    // Detect priority
    const priorityResult = detectPriority(analysisText, aiExtraction?.urgency);
    const priorityId = priorityResult.priorityId;
    const priorityConfidence = priorityResult.confidence;

    // Description (use summary as base)
    const descriptionValue = summaryValue;
    const descriptionConfidence = summaryConfidence * 0.9; // Slightly lower than summary

    // Extract action items
    const actionItems = aiExtraction?.actionItems || [];

    // Calculate processing time
    const processingMs = Date.now() - startTime;

    // Cache the extraction
    const [cached] = await db
      .select({ id: serviceRequestExtractions.id, extractionVersion: serviceRequestExtractions.extractionVersion })
      .from(serviceRequestExtractions)
      .where(eq(serviceRequestExtractions.wrapupDraftId, wrapupId))
      .limit(1);

    const extractionVersion = cached ? cached.extractionVersion + 1 : 1;

    await db
      .insert(serviceRequestExtractions)
      .values({
        tenantId,
        wrapupDraftId: wrapupId,
        summary: summaryValue,
        summaryConfidence,
        categoryId,
        categoryConfidence,
        priorityId,
        priorityConfidence,
        description: descriptionValue,
        descriptionConfidence,
        requestType: wrapup.requestType,
        urgency: aiExtraction?.urgency || null,
        actionItems,
        modelUsed: 'keyword-hybrid',
        processingMs,
        extractionVersion,
      })
      .onConflictDoUpdate({
        target: serviceRequestExtractions.wrapupDraftId,
        set: {
          summary: summaryValue,
          summaryConfidence,
          categoryId,
          categoryConfidence,
          priorityId,
          priorityConfidence,
          description: descriptionValue,
          descriptionConfidence,
          requestType: wrapup.requestType,
          urgency: aiExtraction?.urgency || null,
          actionItems,
          processingMs,
          extractionVersion,
          updatedAt: new Date(),
        },
      });

    const result: ExtractionResult = {
      summary: {
        value: summaryValue,
        confidence: summaryConfidence,
        source: wrapup.aiCleanedSummary ? 'ai' : 'keyword',
      },
      category: {
        value: { id: categoryId, name: CATEGORY_NAME_MAP[categoryId] || 'Unknown' },
        confidence: categoryConfidence,
      },
      priority: {
        value: { id: priorityId, name: PRIORITY_NAME_MAP[priorityId] || 'Unknown' },
        confidence: priorityConfidence,
      },
      description: {
        value: descriptionValue,
        confidence: descriptionConfidence,
      },
      requestType: wrapup.requestType,
      urgency: aiExtraction?.urgency || null,
      actionItems,
      extractedAt: new Date().toISOString(),
      extractionVersion,
      cached: false,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Extract API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to extract service request data' },
      { status: 500 }
    );
  }
}
