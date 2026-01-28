/**
 * Evaluation Dataset Builder
 * ==========================
 * Builds evaluation datasets from agent corrections for testing AI prompts.
 *
 * The dataset consists of (transcript, expected_output) pairs derived from
 * corrections - where expected_output is the agent-corrected value.
 */

import { db } from '@/db';
import { aiCorrections, wrapupDrafts, calls } from '@/db/schema';
import { eq, and, gte, desc, isNotNull } from 'drizzle-orm';

// =============================================================================
// TYPES
// =============================================================================

export interface EvaluationExample {
  correctionId: string;
  transcript: string;
  fieldName: string;
  aiValue: string | null;
  expectedValue: string | null;
  correctionType: string;
  createdAt: Date;
}

export interface EvaluationDataset {
  examples: EvaluationExample[];
  metadata: {
    startDate: Date;
    endDate: Date;
    totalExamples: number;
    fieldCounts: Record<string, number>;
    correctionTypeCounts: Record<string, number>;
  };
}

export interface DatasetOptions {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  maxExamples?: number;
  fieldNames?: string[];
  excludeUsedInEvaluation?: boolean;
}

// =============================================================================
// BUILD EVALUATION DATASET
// =============================================================================

/**
 * Build an evaluation dataset from corrections
 */
export async function buildEvaluationDataset(
  options: DatasetOptions
): Promise<EvaluationDataset> {
  const {
    tenantId,
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
    endDate = new Date(),
    maxExamples = 100,
    fieldNames,
    excludeUsedInEvaluation = true,
  } = options;

  // Build query conditions
  const conditions = [
    eq(aiCorrections.tenantId, tenantId),
    gte(aiCorrections.correctedAt, startDate),
    isNotNull(aiCorrections.fullTranscript),
  ];

  if (excludeUsedInEvaluation) {
    conditions.push(eq(aiCorrections.usedInEvaluation, false));
  }

  // Query corrections with transcripts
  const corrections = await db
    .select({
      id: aiCorrections.id,
      fieldName: aiCorrections.fieldName,
      aiValue: aiCorrections.aiValue,
      agentValue: aiCorrections.agentValue,
      correctionType: aiCorrections.correctionType,
      fullTranscript: aiCorrections.fullTranscript,
      createdAt: aiCorrections.createdAt,
    })
    .from(aiCorrections)
    .where(and(...conditions))
    .orderBy(desc(aiCorrections.correctedAt))
    .limit(maxExamples);

  // Filter by field names if specified
  let filteredCorrections = corrections;
  if (fieldNames && fieldNames.length > 0) {
    filteredCorrections = corrections.filter((c) => fieldNames.includes(c.fieldName));
  }

  // Build examples
  const examples: EvaluationExample[] = filteredCorrections.map((c) => ({
    correctionId: c.id,
    transcript: c.fullTranscript!,
    fieldName: c.fieldName,
    aiValue: c.aiValue,
    expectedValue: c.agentValue,
    correctionType: c.correctionType,
    createdAt: c.createdAt,
  }));

  // Calculate metadata
  const fieldCounts: Record<string, number> = {};
  const correctionTypeCounts: Record<string, number> = {};

  for (const example of examples) {
    fieldCounts[example.fieldName] = (fieldCounts[example.fieldName] || 0) + 1;
    correctionTypeCounts[example.correctionType] =
      (correctionTypeCounts[example.correctionType] || 0) + 1;
  }

  return {
    examples,
    metadata: {
      startDate,
      endDate,
      totalExamples: examples.length,
      fieldCounts,
      correctionTypeCounts,
    },
  };
}

// =============================================================================
// MARK CORRECTIONS AS USED
// =============================================================================

/**
 * Mark corrections as used in evaluation
 */
export async function markCorrectionsAsUsed(
  correctionIds: string[],
  evaluationBatchId: string
): Promise<void> {
  if (correctionIds.length === 0) return;

  await db
    .update(aiCorrections)
    .set({
      usedInEvaluation: true,
      evaluationBatchId,
    })
    .where(
      and(
        eq(aiCorrections.usedInEvaluation, false),
        // Use a subquery approach for IN clause
      )
    );

  // Update in batches to avoid SQL length limits
  const batchSize = 100;
  for (let i = 0; i < correctionIds.length; i += batchSize) {
    const batch = correctionIds.slice(i, i + batchSize);
    for (const id of batch) {
      await db
        .update(aiCorrections)
        .set({
          usedInEvaluation: true,
          evaluationBatchId,
        })
        .where(eq(aiCorrections.id, id));
    }
  }
}

// =============================================================================
// GET DATASET STATISTICS
// =============================================================================

/**
 * Get statistics about available corrections for evaluation
 */
export async function getDatasetStatistics(tenantId: string): Promise<{
  totalCorrections: number;
  unusedCorrections: number;
  correctionsWithTranscript: number;
  byField: Record<string, number>;
  byType: Record<string, number>;
  oldestCorrection: Date | null;
  newestCorrection: Date | null;
}> {
  const allCorrections = await db
    .select({
      id: aiCorrections.id,
      fieldName: aiCorrections.fieldName,
      correctionType: aiCorrections.correctionType,
      usedInEvaluation: aiCorrections.usedInEvaluation,
      hasTranscript: isNotNull(aiCorrections.fullTranscript),
      createdAt: aiCorrections.createdAt,
    })
    .from(aiCorrections)
    .where(eq(aiCorrections.tenantId, tenantId))
    .orderBy(aiCorrections.createdAt);

  const byField: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let unusedCount = 0;
  let withTranscriptCount = 0;

  for (const c of allCorrections) {
    byField[c.fieldName] = (byField[c.fieldName] || 0) + 1;
    byType[c.correctionType] = (byType[c.correctionType] || 0) + 1;
    if (!c.usedInEvaluation) unusedCount++;
    if (c.hasTranscript) withTranscriptCount++;
  }

  return {
    totalCorrections: allCorrections.length,
    unusedCorrections: unusedCount,
    correctionsWithTranscript: withTranscriptCount,
    byField,
    byType,
    oldestCorrection: allCorrections.length > 0 ? allCorrections[0].createdAt : null,
    newestCorrection:
      allCorrections.length > 0 ? allCorrections[allCorrections.length - 1].createdAt : null,
  };
}

// =============================================================================
// EXPORT DATASET FOR EXTERNAL TESTING
// =============================================================================

/**
 * Export dataset in a format suitable for external testing tools
 */
export function exportDatasetAsJsonl(dataset: EvaluationDataset): string {
  const lines = dataset.examples.map((example) =>
    JSON.stringify({
      id: example.correctionId,
      input: example.transcript,
      expected: {
        field: example.fieldName,
        value: example.expectedValue,
      },
      metadata: {
        aiValue: example.aiValue,
        correctionType: example.correctionType,
      },
    })
  );

  return lines.join('\n');
}
