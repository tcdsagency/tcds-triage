/**
 * One-time enrichment: Fill coverage gaps in AL3 baselines from HawkSoft data.
 *
 * For each baseline with incomplete coverage data (missing DWELL, PL, BI, etc.),
 * looks up the linked policy in the `policies` table and merges any missing
 * coverages from `policies.coverages` JSONB into the baseline snapshot.
 *
 * No API calls — uses only locally-cached HawkSoft data.
 *
 * Usage: npx tsx scripts/tmp-enrich-baselines-from-hawksoft.ts [--dry-run]
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const DRY_RUN = process.argv.includes('--dry-run');

/** Key coverage types per LOB that indicate a "complete" baseline. */
const HOME_KEY_COVERAGES = ['dwelling', 'personal_liability'];
const AUTO_KEY_COVERAGES = ['bodily_injury'];

const BATCH_SIZE = 100;

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');
  const { normalizeHawkSoftCoverages } = await import('../src/lib/al3/baseline-builder');
  const { DISCOUNT_COVERAGE_TYPES, RATING_FACTOR_TYPES } = await import('../src/lib/al3/constants');

  console.log(`[Enrich] Starting HawkSoft baseline enrichment${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  // Step 1: Get count and IDs of eligible baselines (lightweight query)
  const countResult = await db.execute(sql`
    SELECT count(*)::int as cnt
    FROM renewal_baselines rb
    INNER JOIN policies p ON rb.policy_id = p.id
    WHERE rb.policy_id IS NOT NULL
      AND p.coverages IS NOT NULL
      AND jsonb_array_length(p.coverages) > 0
  `);
  const totalEligible = (countResult[0] as any).cnt;
  console.log(`[Enrich] Found ${totalEligible} baselines with linked HawkSoft policies\n`);

  let enrichedCount = 0;
  let skippedAlreadyComplete = 0;
  let skippedNoGains = 0;
  let totalProcessed = 0;
  const enrichedByCarrier: Record<string, { enriched: number; total: number; types: Set<string> }> = {};

  // Step 2: Process in batches using OFFSET/LIMIT
  for (let offset = 0; offset < totalEligible; offset += BATCH_SIZE) {
    const batch = await db.execute(sql`
      SELECT
        rb.id,
        rb.policy_number,
        rb.carrier_code,
        rb.carrier_name,
        rb.line_of_business,
        rb.policy_id,
        rb.snapshot,
        p.coverages AS hs_coverages
      FROM renewal_baselines rb
      INNER JOIN policies p ON rb.policy_id = p.id
      WHERE rb.policy_id IS NOT NULL
        AND p.coverages IS NOT NULL
        AND jsonb_array_length(p.coverages) > 0
      ORDER BY rb.id
      LIMIT ${BATCH_SIZE}
      OFFSET ${offset}
    `);

    if (batch.length === 0) break;
    console.log(`[Enrich] Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (${offset + 1}-${offset + batch.length} of ${totalEligible})...`);

    for (const row of batch as any[]) {
      totalProcessed++;
      const snapshot = row.snapshot as any;
      if (!snapshot || !snapshot.coverages) continue;

      const lob = (row.line_of_business || '').toLowerCase();
      const isHome = lob.includes('home') || lob.includes('dwelling') || lob.includes('fire');
      const isAuto = lob.includes('auto') && !lob.includes('home');

      // Track carrier totals
      const carrierKey = row.carrier_name || row.carrier_code || 'UNKNOWN';
      if (!enrichedByCarrier[carrierKey]) {
        enrichedByCarrier[carrierKey] = { enriched: 0, total: 0, types: new Set() };
      }
      enrichedByCarrier[carrierKey].total++;

      // Determine which key coverages this baseline is missing
      const existingTypes = new Set(
        (snapshot.coverages as any[]).map((c: any) => c.type)
      );

      let keyCoverages: string[];
      if (isHome) {
        keyCoverages = HOME_KEY_COVERAGES;
      } else if (isAuto) {
        keyCoverages = AUTO_KEY_COVERAGES;
      } else {
        keyCoverages = [...HOME_KEY_COVERAGES, ...AUTO_KEY_COVERAGES];
      }

      const missingKeys = keyCoverages.filter((k) => {
        const existing = (snapshot.coverages as any[]).find(
          (c: any) => c.type === k && c.limitAmount && c.limitAmount > 0
        );
        return !existing;
      });

      if (missingKeys.length === 0) {
        skippedAlreadyComplete++;
        continue;
      }

      // Normalize HawkSoft coverages from policies table
      const hsCoverages = normalizeHawkSoftCoverages(row.hs_coverages as any[]);

      // Filter to real coverages only (no discounts, no rating factors)
      const realHsCoverages = hsCoverages.filter(
        (c) => !DISCOUNT_COVERAGE_TYPES.has(c.type) && !RATING_FACTOR_TYPES.has(c.type)
      );

      // Find coverages that fill gaps
      const newCoverages: any[] = [];
      const filledTypes: string[] = [];
      for (const missing of missingKeys) {
        const hsCov = realHsCoverages.find(
          (c) => c.type === missing && c.limitAmount && c.limitAmount > 0
        );
        if (hsCov) {
          if (!existingTypes.has(missing)) {
            newCoverages.push({ ...hsCov, enrichedFromHawksoft: true });
          } else {
            // Update existing coverage with HawkSoft limit
            for (const existing of snapshot.coverages as any[]) {
              if (existing.type === missing && (!existing.limitAmount || existing.limitAmount <= 0)) {
                existing.limitAmount = hsCov.limitAmount;
                existing.limit = hsCov.limit || String(hsCov.limitAmount);
                existing.enrichedFromHawksoft = true;
                if (hsCov.deductibleAmount && !existing.deductibleAmount) {
                  existing.deductibleAmount = hsCov.deductibleAmount;
                  existing.deductible = hsCov.deductible;
                }
              }
            }
          }
          filledTypes.push(missing);
        }
      }

      // Also check for other real coverages in HawkSoft that baseline is missing entirely
      for (const hsCov of realHsCoverages) {
        if (
          !existingTypes.has(hsCov.type) &&
          !newCoverages.find((c) => c.type === hsCov.type) &&
          hsCov.limitAmount &&
          hsCov.limitAmount > 0
        ) {
          newCoverages.push({ ...hsCov, enrichedFromHawksoft: true });
          filledTypes.push(hsCov.type);
        }
      }

      if (filledTypes.length === 0) {
        skippedNoGains++;
        continue;
      }

      // Merge new coverages into snapshot
      const updatedCoverages = [...(snapshot.coverages as any[]), ...newCoverages];
      const updatedSnapshot = {
        ...snapshot,
        coverages: updatedCoverages,
        enrichedFromHawksoft: true,
      };

      enrichedByCarrier[carrierKey].enriched++;
      for (const t of filledTypes) enrichedByCarrier[carrierKey].types.add(t);

      if (!DRY_RUN) {
        await db.execute(sql`
          UPDATE renewal_baselines
          SET snapshot = ${JSON.stringify(updatedSnapshot)}::jsonb,
              updated_at = NOW()
          WHERE id = ${row.id}::uuid
        `);
      }

      enrichedCount++;
      if (enrichedCount <= 30) {
        console.log(
          `  [${DRY_RUN ? 'WOULD' : 'DID'}] Enrich ${row.policy_number} (${carrierKey}): +${filledTypes.join(', ')}`
        );
      }
    }
  }

  console.log(`\n=== Enrichment Summary${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);
  console.log(`Total baselines with linked policies: ${totalProcessed}`);
  console.log(`Already complete (no gaps):           ${skippedAlreadyComplete}`);
  console.log(`No HawkSoft data to fill gaps:        ${skippedNoGains}`);
  console.log(`Enriched:                             ${enrichedCount}\n`);

  console.log('By carrier:');
  console.log('Carrier                       | Enriched / Total | Types Added');
  console.log('------------------------------|------------------|------------------');
  for (const [carrier, stats] of Object.entries(enrichedByCarrier).sort((a, b) => b[1].enriched - a[1].enriched)) {
    if (stats.enriched > 0) {
      console.log(
        carrier.substring(0, 30).padEnd(30) + '| ' +
        `${stats.enriched}/${stats.total}`.padEnd(17) + '| ' +
        Array.from(stats.types).join(', ')
      );
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
