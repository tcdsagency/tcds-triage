/**
 * Prompt Regression Testing
 * =========================
 * Run transcripts through prompts and compare outputs to agent-corrected values.
 * Used to test new prompt versions before deployment.
 */

import { db } from '@/db';
import { promptVersions, evaluationRuns } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { EvaluationDataset, EvaluationExample } from './evaluation-dataset';

// =============================================================================
// TYPES
// =============================================================================

export interface FieldResult {
  correct: boolean;
  aiValue: string | null;
  expectedValue: string | null;
  similarity?: number;
}

export interface ExampleResult {
  correctionId: string;
  fieldName: string;
  aiOutput: string | null;
  expectedOutput: string | null;
  correct: boolean;
  similarity: number;
}

export interface EvaluationResult {
  promptVersionId: string;
  overallAccuracy: number;
  fieldAccuracies: Record<string, number>;
  examples: ExampleResult[];
  failures: Array<{ correctionId: string; error: string }>;
  runDuration: number;
}

export interface RegressionComparison {
  baselineVersionId: string;
  newVersionId: string;
  baselineAccuracy: number;
  newAccuracy: number;
  improvementDelta: number;
  regressions: Array<{
    correctionId: string;
    fieldName: string;
    baselineCorrect: boolean;
    newCorrect: boolean;
  }>;
  improvements: Array<{
    correctionId: string;
    fieldName: string;
    baselineCorrect: boolean;
    newCorrect: boolean;
  }>;
}

// =============================================================================
// RUN EVALUATION
// =============================================================================

/**
 * Run evaluation on a dataset with a specific prompt version
 */
export async function runEvaluation(
  promptVersionId: string,
  dataset: EvaluationDataset,
  options: {
    maxConcurrency?: number;
    timeoutMs?: number;
  } = {}
): Promise<EvaluationResult> {
  const { maxConcurrency = 3, timeoutMs = 30000 } = options;
  const startTime = Date.now();

  // Get the prompt version
  const [prompt] = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.id, promptVersionId))
    .limit(1);

  if (!prompt) {
    throw new Error(`Prompt version ${promptVersionId} not found`);
  }

  const results: ExampleResult[] = [];
  const failures: Array<{ correctionId: string; error: string }> = [];

  // Process examples with concurrency limit
  const batches: EvaluationExample[][] = [];
  for (let i = 0; i < dataset.examples.length; i += maxConcurrency) {
    batches.push(dataset.examples.slice(i, i + maxConcurrency));
  }

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (example) => {
        try {
          const result = await evaluateSingleExample(
            example,
            prompt.systemPrompt,
            prompt.userPromptTemplate,
            timeoutMs
          );
          return { success: true, result };
        } catch (error: any) {
          return {
            success: false,
            error: error.message || 'Unknown error',
            correctionId: example.correctionId,
          };
        }
      })
    );

    for (const item of batchResults) {
      if (item.success && 'result' in item && item.result) {
        results.push(item.result);
      } else if (!item.success && 'error' in item && 'correctionId' in item) {
        failures.push({
          correctionId: item.correctionId as string,
          error: item.error as string,
        });
      }
    }
  }

  // Calculate accuracies
  const fieldResults: Record<string, { correct: number; total: number }> = {};

  for (const result of results) {
    if (!fieldResults[result.fieldName]) {
      fieldResults[result.fieldName] = { correct: 0, total: 0 };
    }
    fieldResults[result.fieldName].total++;
    if (result.correct) {
      fieldResults[result.fieldName].correct++;
    }
  }

  const fieldAccuracies: Record<string, number> = {};
  for (const [field, counts] of Object.entries(fieldResults)) {
    fieldAccuracies[field] = counts.total > 0 ? counts.correct / counts.total : 0;
  }

  const totalCorrect = results.filter((r) => r.correct).length;
  const overallAccuracy = results.length > 0 ? totalCorrect / results.length : 0;

  return {
    promptVersionId,
    overallAccuracy,
    fieldAccuracies,
    examples: results,
    failures,
    runDuration: Date.now() - startTime,
  };
}

// =============================================================================
// EVALUATE SINGLE EXAMPLE
// =============================================================================

async function evaluateSingleExample(
  example: EvaluationExample,
  systemPrompt: string,
  userPromptTemplate: string,
  timeoutMs: number
): Promise<ExampleResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Build user prompt from template
  const userPrompt = userPromptTemplate.replace('{{transcript}}', example.transcript);

  // Call OpenAI
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(content);

    // Extract the relevant field value from AI output
    const aiOutput = extractFieldValue(parsed, example.fieldName);

    // Compare with expected value
    const { correct, similarity } = compareValues(aiOutput, example.expectedValue);

    return {
      correctionId: example.correctionId,
      fieldName: example.fieldName,
      aiOutput,
      expectedOutput: example.expectedValue,
      correct,
      similarity,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract the value for a specific field from AI output
 */
function extractFieldValue(parsed: Record<string, any>, fieldName: string): string | null {
  // Map field names to possible locations in the response
  const fieldMappings: Record<string, string[]> = {
    customerName: ['customerName', 'extractedData.customerName'],
    summary: ['summary', 'overallSummary'],
    requestType: ['serviceRequestType', 'requestType', 'callType'],
    policyNumbers: ['extractedData.policyNumber', 'policyNumbers'],
    actionItems: ['actionItems'],
    sentiment: ['sentiment'],
  };

  const paths = fieldMappings[fieldName] || [fieldName];

  for (const path of paths) {
    const value = getNestedValue(parsed, path);
    if (value !== undefined && value !== null) {
      return Array.isArray(value) ? value.join(', ') : String(value);
    }
  }

  return null;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Compare AI output to expected value
 */
function compareValues(
  aiValue: string | null,
  expectedValue: string | null
): { correct: boolean; similarity: number } {
  // Normalize values
  const normalizedAi = (aiValue || '').toLowerCase().trim();
  const normalizedExpected = (expectedValue || '').toLowerCase().trim();

  // Exact match
  if (normalizedAi === normalizedExpected) {
    return { correct: true, similarity: 1.0 };
  }

  // Both empty
  if (!normalizedAi && !normalizedExpected) {
    return { correct: true, similarity: 1.0 };
  }

  // One empty, one not
  if (!normalizedAi || !normalizedExpected) {
    return { correct: false, similarity: 0.0 };
  }

  // Calculate similarity (simple Jaccard for now)
  const similarity = calculateSimilarity(normalizedAi, normalizedExpected);

  // Consider correct if similarity > 0.8
  return { correct: similarity > 0.8, similarity };
}

/**
 * Calculate string similarity (Jaccard index on words)
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.split(/\s+/).filter(Boolean));

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  if (union.size === 0) return 1.0;
  return intersection.size / union.size;
}

// =============================================================================
// COMPARE VERSIONS
// =============================================================================

/**
 * Compare two prompt versions on the same dataset
 */
export async function compareVersions(
  baselineResult: EvaluationResult,
  newResult: EvaluationResult
): Promise<RegressionComparison> {
  const regressions: RegressionComparison['regressions'] = [];
  const improvements: RegressionComparison['improvements'] = [];

  // Build lookup for baseline results
  const baselineMap = new Map(
    baselineResult.examples.map((e) => [e.correctionId, e])
  );

  // Compare each example
  for (const newExample of newResult.examples) {
    const baselineExample = baselineMap.get(newExample.correctionId);
    if (!baselineExample) continue;

    if (baselineExample.correct && !newExample.correct) {
      // Regression: was correct, now wrong
      regressions.push({
        correctionId: newExample.correctionId,
        fieldName: newExample.fieldName,
        baselineCorrect: true,
        newCorrect: false,
      });
    } else if (!baselineExample.correct && newExample.correct) {
      // Improvement: was wrong, now correct
      improvements.push({
        correctionId: newExample.correctionId,
        fieldName: newExample.fieldName,
        baselineCorrect: false,
        newCorrect: true,
      });
    }
  }

  return {
    baselineVersionId: baselineResult.promptVersionId,
    newVersionId: newResult.promptVersionId,
    baselineAccuracy: baselineResult.overallAccuracy,
    newAccuracy: newResult.overallAccuracy,
    improvementDelta: newResult.overallAccuracy - baselineResult.overallAccuracy,
    regressions,
    improvements,
  };
}

// =============================================================================
// SAVE EVALUATION RUN
// =============================================================================

/**
 * Save evaluation run to database
 */
export async function saveEvaluationRun(
  tenantId: string | null,
  promptVersionId: string,
  result: EvaluationResult,
  baselinePromptVersionId?: string,
  comparison?: RegressionComparison,
  triggeredById?: string,
  triggerType: string = 'manual'
): Promise<string> {
  const [run] = await db
    .insert(evaluationRuns)
    .values({
      tenantId,
      promptVersionId,
      baselinePromptVersionId,
      evaluationDatasetSize: result.examples.length + result.failures.length,
      status: 'completed',
      results: {
        examples: result.examples.map((e) => ({
          correctionId: e.correctionId,
          aiOutput: { [e.fieldName]: e.aiOutput ?? '' },
          expectedOutput: { [e.fieldName]: e.expectedOutput ?? '' },
          fieldResults: {
            [e.fieldName]: {
              correct: e.correct,
              aiValue: e.aiOutput ?? '',
              expectedValue: e.expectedOutput ?? '',
            },
          },
        })),
        failures: result.failures,
      },
      overallAccuracy: result.overallAccuracy.toFixed(4),
      fieldAccuracies: result.fieldAccuracies,
      improvementDelta: comparison?.improvementDelta?.toFixed(4) || null,
      startedAt: new Date(Date.now() - result.runDuration),
      completedAt: new Date(),
      triggeredById,
      triggerType,
    })
    .returning({ id: evaluationRuns.id });

  return run.id;
}

// =============================================================================
// GET ACTIVE PROMPT
// =============================================================================

/**
 * Get the currently active prompt version
 */
export async function getActivePromptVersion(
  tenantId: string | null,
  promptType: string
): Promise<typeof promptVersions.$inferSelect | null> {
  const conditions = [
    eq(promptVersions.promptType, promptType),
    eq(promptVersions.status, 'active'),
  ];

  if (tenantId) {
    conditions.push(eq(promptVersions.tenantId, tenantId));
  }

  const [prompt] = await db
    .select()
    .from(promptVersions)
    .where(and(...conditions))
    .orderBy(desc(promptVersions.activatedAt))
    .limit(1);

  return prompt || null;
}
