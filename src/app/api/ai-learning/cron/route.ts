/**
 * AI Learning Cron Job
 * ====================
 * Runs weekly to:
 * 1. Aggregate corrections from the past week
 * 2. Generate AI improvement suggestions
 * 3. Create draft prompt version with improvements
 * 4. Run evaluation against baseline
 * 5. Send report notification
 *
 * Schedule: Every Monday at 9am (configure in vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { aiCorrections, promptVersions, evaluationRuns } from '@/db/schema';
import { eq, and, gte, desc, count, sql } from 'drizzle-orm';
import {
  buildEvaluationDataset,
  markCorrectionsAsUsed,
  getDatasetStatistics,
} from '@/lib/feedback/evaluation-dataset';
import {
  runEvaluation,
  compareVersions,
  saveEvaluationRun,
  getActivePromptVersion,
} from '@/lib/feedback/prompt-regression';

// =============================================================================
// CRON HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  // Verify this is a cron request (Vercel sets this header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow manual trigger in development, or verify cron secret in production
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json(
      { success: false, error: 'Tenant not configured' },
      { status: 500 }
    );
  }

  console.log('[AI-Learning] Starting weekly learning job...');

  try {
    // 1. Get correction statistics for the past week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const stats = await getWeeklyStats(tenantId, oneWeekAgo);
    console.log('[AI-Learning] Week stats:', stats);

    // Skip if not enough corrections
    if (stats.totalCorrections < 5) {
      console.log('[AI-Learning] Not enough corrections this week, skipping.');
      return NextResponse.json({
        success: true,
        message: 'Skipped - insufficient corrections',
        stats,
      });
    }

    // 2. Build evaluation dataset
    const dataset = await buildEvaluationDataset({
      tenantId,
      startDate: oneWeekAgo,
      maxExamples: 50,
      excludeUsedInEvaluation: true,
    });

    console.log(`[AI-Learning] Built dataset with ${dataset.examples.length} examples`);

    if (dataset.examples.length < 5) {
      console.log('[AI-Learning] Not enough examples with transcripts, skipping.');
      return NextResponse.json({
        success: true,
        message: 'Skipped - insufficient examples with transcripts',
        stats,
      });
    }

    // 3. Get active prompt version
    const activePrompt = await getActivePromptVersion(tenantId, 'transcript_extraction');

    if (!activePrompt) {
      console.log('[AI-Learning] No active prompt version found, creating baseline...');
      // Create initial prompt version
      await createInitialPromptVersion(tenantId);
      return NextResponse.json({
        success: true,
        message: 'Created initial prompt version',
        stats,
      });
    }

    // 4. Generate improvement suggestions using AI
    const suggestions = await generateImprovementSuggestions(stats, dataset);
    console.log('[AI-Learning] Generated suggestions:', suggestions.substring(0, 200));

    // 5. Create draft prompt version with improvements
    const draftVersion = await createDraftPromptVersion(
      tenantId,
      activePrompt,
      suggestions
    );
    console.log(`[AI-Learning] Created draft prompt version: ${draftVersion.id}`);

    // 6. Run evaluation on baseline
    console.log('[AI-Learning] Running baseline evaluation...');
    const baselineResult = await runEvaluation(activePrompt.id, dataset, {
      maxConcurrency: 2,
      timeoutMs: 30000,
    });

    // 7. Run evaluation on draft
    console.log('[AI-Learning] Running draft evaluation...');
    const draftResult = await runEvaluation(draftVersion.id, dataset, {
      maxConcurrency: 2,
      timeoutMs: 30000,
    });

    // 8. Compare results
    const comparison = await compareVersions(baselineResult, draftResult);
    console.log(`[AI-Learning] Comparison: baseline=${comparison.baselineAccuracy.toFixed(3)}, new=${comparison.newAccuracy.toFixed(3)}, delta=${comparison.improvementDelta.toFixed(3)}`);

    // 9. Save evaluation run
    const runId = await saveEvaluationRun(
      tenantId,
      draftVersion.id,
      draftResult,
      activePrompt.id,
      comparison,
      undefined,
      'scheduled'
    );
    console.log(`[AI-Learning] Saved evaluation run: ${runId}`);

    // 10. Mark corrections as used
    await markCorrectionsAsUsed(
      dataset.examples.map((e) => e.correctionId),
      runId
    );

    // 11. Update draft version with evaluation results
    await db
      .update(promptVersions)
      .set({
        evaluationResults: {
          overall_accuracy: draftResult.overallAccuracy,
          field_accuracies: draftResult.fieldAccuracies,
          sample_size: dataset.examples.length,
          tested_at: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(promptVersions.id, draftVersion.id));

    // Build report
    const report = {
      weekEnding: new Date().toISOString().split('T')[0],
      stats,
      evaluation: {
        baselineAccuracy: baselineResult.overallAccuracy,
        draftAccuracy: draftResult.overallAccuracy,
        improvementDelta: comparison.improvementDelta,
        regressionCount: comparison.regressions.length,
        improvementCount: comparison.improvements.length,
      },
      draftVersionId: draftVersion.id,
      evaluationRunId: runId,
      recommendation:
        comparison.improvementDelta > 0.02
          ? 'RECOMMEND_ACTIVATE'
          : comparison.improvementDelta < -0.02
          ? 'DO_NOT_ACTIVATE'
          : 'MANUAL_REVIEW',
    };

    console.log('[AI-Learning] Weekly job complete:', JSON.stringify(report, null, 2));

    // TODO: Send notification (email, Slack, etc.)

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('[AI-Learning] Error in weekly job:', error);
    return NextResponse.json(
      { success: false, error: 'Weekly job failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getWeeklyStats(tenantId: string, since: Date) {
  // Total corrections
  const [totalResult] = await db
    .select({ count: count() })
    .from(aiCorrections)
    .where(
      and(eq(aiCorrections.tenantId, tenantId), gte(aiCorrections.correctedAt, since))
    );

  // By field
  const byField = await db
    .select({
      fieldName: aiCorrections.fieldName,
      count: count(),
    })
    .from(aiCorrections)
    .where(
      and(eq(aiCorrections.tenantId, tenantId), gte(aiCorrections.correctedAt, since))
    )
    .groupBy(aiCorrections.fieldName)
    .orderBy(desc(count()));

  // By type
  const byType = await db
    .select({
      correctionType: aiCorrections.correctionType,
      count: count(),
    })
    .from(aiCorrections)
    .where(
      and(eq(aiCorrections.tenantId, tenantId), gte(aiCorrections.correctedAt, since))
    )
    .groupBy(aiCorrections.correctionType)
    .orderBy(desc(count()));

  return {
    totalCorrections: totalResult.count,
    byField: Object.fromEntries(byField.map((f) => [f.fieldName, f.count])),
    byType: Object.fromEntries(byType.map((t) => [t.correctionType, t.count])),
  };
}

async function generateImprovementSuggestions(
  stats: any,
  dataset: any
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return 'Unable to generate suggestions - OpenAI API key not configured.';
  }

  // Build context for AI
  const context = `
## Correction Statistics (Past Week)
Total corrections: ${stats.totalCorrections}

### By Field:
${Object.entries(stats.byField)
  .map(([field, count]) => `- ${field}: ${count} corrections`)
  .join('\n')}

### By Type:
${Object.entries(stats.byType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

### Example Corrections:
${dataset.examples
  .slice(0, 5)
  .map(
    (e: any) => `
Field: ${e.fieldName}
AI said: "${e.aiValue || '(empty)'}"
Agent corrected to: "${e.expectedValue || '(empty)'}"
Type: ${e.correctionType}
`
  )
  .join('\n---\n')}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI prompt engineer analyzing correction data from an insurance call center.
Your task is to suggest specific improvements to the transcript extraction prompt based on the patterns in agent corrections.

Focus on:
1. Common fields that are frequently corrected
2. Patterns in the types of corrections (wrong_value, missing_value, etc.)
3. Specific wording changes to improve extraction accuracy
4. Examples that could be added to the prompt

Be specific and actionable. Output should be usable prompt improvements.`,
          },
          {
            role: 'user',
            content: context,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      return 'Unable to generate suggestions - API error.';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No suggestions generated.';
  } catch (error) {
    console.error('[AI-Learning] Error generating suggestions:', error);
    return 'Unable to generate suggestions - error occurred.';
  }
}

async function createDraftPromptVersion(
  tenantId: string,
  activePrompt: typeof promptVersions.$inferSelect,
  suggestions: string
): Promise<typeof promptVersions.$inferSelect> {
  // Get next version number
  const [lastVersion] = await db
    .select({ version: promptVersions.version })
    .from(promptVersions)
    .where(eq(promptVersions.promptType, activePrompt.promptType))
    .orderBy(desc(promptVersions.version))
    .limit(1);

  const nextVersion = (lastVersion?.version || 0) + 1;

  const [draftVersion] = await db
    .insert(promptVersions)
    .values({
      tenantId,
      version: nextVersion,
      name: `Auto-generated v${nextVersion}`,
      promptType: activePrompt.promptType,
      systemPrompt: activePrompt.systemPrompt, // Keep same for now
      userPromptTemplate: activePrompt.userPromptTemplate, // Keep same for now
      status: 'draft',
      suggestedImprovements: suggestions,
    })
    .returning();

  return draftVersion;
}

async function createInitialPromptVersion(tenantId: string): Promise<void> {
  // Create the initial transcript extraction prompt version
  await db.insert(promptVersions).values({
    tenantId,
    version: 1,
    name: 'Initial Transcript Extraction',
    promptType: 'transcript_extraction',
    systemPrompt: `You are an insurance agency call analyst creating service request summaries.
Extract key information from the call transcript and return structured data.`,
    userPromptTemplate: `Analyze this call transcript and extract the key information:

{{transcript}}

Return a JSON object with: summary, customerName, policyNumbers, actionItems, sentiment, serviceRequestType.`,
    status: 'active',
    activatedAt: new Date(),
  });
}
