/**
 * Reprocess National General home baselines from raw ZIP files using the
 * current (improved) EDIFACT parser.
 *
 * Since rawAl3Content is not stored in the DB, this reads from the local
 * IVANS ZIP download directory and upserts parsed baselines.
 *
 * Usage: npx tsx scripts/tmp-reprocess-natgen-baselines.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import fs from 'fs';

const INPUT_DIR = 'C:/Users/ToddConn/AppData/Local/Temp/ivanspoldls';

async function main() {
  const { db } = await import('../src/db');
  const { renewalBaselines, policies } = await import('../src/db/schema');
  const { eq, and } = await import('drizzle-orm');
  const { extractAL3FilesFromZip } = await import('../src/lib/al3/zip-extractor');
  const { parseAL3File } = await import('../src/lib/al3/parser');
  const { buildRenewalSnapshot } = await import('../src/lib/al3/snapshot-builder');
  const { deduplicateRenewals } = await import('../src/lib/al3/filter');

  const tenantId = process.env.DEFAULT_TENANT_ID!;
  console.log('=== Reprocess National General Baselines from Raw ZIPs ===\n');

  // Find NatGen ZIP files — includes Foremost_Signature_ARS360 which also carries NatGen/Integon policies
  const files = fs.readdirSync(INPUT_DIR).filter(f =>
    (f.includes('National_General') || f.includes('NATIONAL_GENERAL') || f.includes('Integon') || f.includes('Foremost_Signature')) &&
    !f.includes('OneChoice') &&
    f.endsWith('.zip')
  );
  console.log(`Found ${files.length} NatGen/Integon/Foremost ZIP files\n`);

  // Policy lookup cache
  const policyCache = new Map<string, { policyId: string; customerId: string } | null>();

  // Stats
  let totalTxns = 0;
  let homeBaselines = 0;
  let upserted = 0;
  let errors = 0;

  // Metrics for home policies
  let hasDwellLimit = 0, hasDwellDed = 0, hasDwellPrem = 0, hasPL = 0;
  let homeCount = 0;

  for (const file of files) {
    try {
      const buffer = fs.readFileSync(path.join(INPUT_DIR, file));
      const al3Files = await extractAL3FilesFromZip(buffer);

      for (const f of al3Files) {
        const transactions = parseAL3File(f.content);
        totalTxns += transactions.length;

        // Process all transactions — we want to upsert baselines for any NatGen home policy
        // regardless of whether it's renewal/current/archived
        for (const tx of transactions) {
          const snap = buildRenewalSnapshot(tx);
          const isHome = snap.coverages.some((c: any) =>
            ['dwelling', 'other_structures', 'personal_property', 'loss_of_use'].includes(c.type)
          );
          if (!isHome) continue;
          homeBaselines++;

          // Track metrics
          homeCount++;
          const dwell = (snap as any).coverages.find((c: any) => c.type === 'dwelling');
          const pl = (snap as any).coverages.find((c: any) => c.type === 'personal_liability');
          if (dwell?.limitAmount && dwell.limitAmount > 1000) hasDwellLimit++;
          if (dwell?.deductibleAmount && dwell.deductibleAmount > 0) hasDwellDed++;
          if (dwell?.premium && dwell.premium > 0) hasDwellPrem++;
          if (pl?.limitAmount && pl.limitAmount >= 100000) hasPL++;

          if (!tx.header.policyNumber || !tx.header.effectiveDate) continue;

          const carrierCode = tx.header.carrierCode || '98';
          const carrierName = tx.header.carrierName || 'National General';

          // Only upsert NatGen/Integon carriers (Foremost ZIPs contain other carriers too)
          const isNatGen = /National General|Integon|Imperial Fire/i.test(carrierName);
          if (!isNatGen) continue;

          // Look up policy
          let policyLink = policyCache.get(tx.header.policyNumber);
          if (policyLink === undefined) {
            const [match] = await db
              .select({ id: policies.id, customerId: policies.customerId })
              .from(policies)
              .where(
                and(
                  eq(policies.tenantId, tenantId),
                  eq(policies.policyNumber, tx.header.policyNumber)
                )
              )
              .limit(1);
            policyLink = match ? { policyId: match.id, customerId: match.customerId } : null;
            policyCache.set(tx.header.policyNumber, policyLink);
          }

          try {
            await db
              .insert(renewalBaselines)
              .values({
                tenantId,
                policyNumber: tx.header.policyNumber,
                carrierCode,
                carrierName,
                lineOfBusiness: 'home',
                insuredName: (snap as any).insuredName || null,
                effectiveDate: new Date(tx.header.effectiveDate),
                expirationDate: tx.header.expirationDate ? new Date(tx.header.expirationDate) : null,
                snapshot: snap,
                rawAl3Content: f.content,
                sourceFileName: file,
                policyId: policyLink?.policyId || null,
                customerId: policyLink?.customerId || null,
              })
              .onConflictDoUpdate({
                target: [
                  renewalBaselines.tenantId,
                  renewalBaselines.carrierCode,
                  renewalBaselines.policyNumber,
                  renewalBaselines.effectiveDate,
                ],
                set: {
                  carrierName,
                  lineOfBusiness: 'home',
                  insuredName: (snap as any).insuredName || null,
                  expirationDate: tx.header.expirationDate ? new Date(tx.header.expirationDate) : null,
                  snapshot: snap,
                  rawAl3Content: f.content,
                  sourceFileName: file,
                  policyId: policyLink?.policyId || null,
                  customerId: policyLink?.customerId || null,
                  updatedAt: new Date(),
                },
              });
            upserted++;
          } catch (err) {
            errors++;
            if (errors <= 5) {
              console.error(`  ERROR upserting ${tx.header.policyNumber}:`, err instanceof Error ? err.message : err);
            }
          }
        }
      }
    } catch (err) {
      console.error(`  ERROR reading ${file}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`ZIP files processed: ${files.length}`);
  console.log(`Total transactions: ${totalTxns}`);
  console.log(`Home baselines found: ${homeBaselines}`);
  console.log(`Upserted to DB: ${upserted}`);
  console.log(`Errors: ${errors}`);

  if (homeCount > 0) {
    console.log(`\n=== Home Coverage Metrics (${homeCount} home baselines from raw files) ===`);
    console.log(`DWELL limit:   ${hasDwellLimit}/${homeCount} (${(hasDwellLimit/homeCount*100).toFixed(1)}%)`);
    console.log(`DWELL ded:     ${hasDwellDed}/${homeCount} (${(hasDwellDed/homeCount*100).toFixed(1)}%)`);
    console.log(`DWELL premium: ${hasDwellPrem}/${homeCount} (${(hasDwellPrem/homeCount*100).toFixed(1)}%)`);
    console.log(`PL >= $100K:   ${hasPL}/${homeCount} (${(hasPL/homeCount*100).toFixed(1)}%)`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
