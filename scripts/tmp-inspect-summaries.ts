/**
 * Inspect Premium Change Summaries
 * =================================
 * Runs the same analysis logic as PremiumChangeSummary.tsx against all
 * active renewals and prints what summary each would get.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import type { MaterialChange, RenewalSnapshot, BaselineSnapshot } from '../src/types/renewal.types';
import type { CheckResult } from '../src/types/check-rules.types';

// ---- Duplicated analysis logic (mirrors PremiumChangeSummary.tsx) ----

type ReasonTag =
  | 'Rate Increase'
  | 'Rate Decrease'
  | 'Rate Adjustment'
  | 'Vehicle Added'
  | 'Vehicle Removed'
  | 'Young Driver Added'
  | 'Driver Added'
  | 'Driver Removed'
  | 'Discount Removed'
  | 'Discount Added'
  | 'Inflation Guard'
  | 'Coverage Removed'
  | 'Coverage Added'
  | 'Coverage Limits Changed'
  | 'Deductible Changed'
  | 'New Claim'
  | 'Property Concern'
  | 'Endorsement Changed';

interface Reason {
  tag: ReasonTag;
  detail?: string;
  color: string;
}

function analyzeReasons(
  materialChanges: MaterialChange[],
  checkResults: CheckResult[],
  renewalSnapshot: RenewalSnapshot | null,
  _baselineSnapshot: BaselineSnapshot | null,
  premiumChangePercent: number | null,
  lineOfBusiness: string | null,
): Reason[] {
  const reasons: Reason[] = [];
  const isHome = lineOfBusiness?.toLowerCase().includes('home') ||
    lineOfBusiness?.toLowerCase().includes('dwelling') ||
    lineOfBusiness?.toLowerCase().includes('ho3') ||
    lineOfBusiness?.toLowerCase().includes('ho5');

  const vehiclesAdded = materialChanges.filter(m => m.category === 'vehicle_added');
  const vehiclesRemoved = materialChanges.filter(m => m.category === 'vehicle_removed');
  if (vehiclesAdded.length > 0) {
    reasons.push({ tag: 'Vehicle Added', detail: vehiclesAdded.length > 1 ? `${vehiclesAdded.length} vehicles` : vehiclesAdded[0].description, color: 'red' });
  }
  if (vehiclesRemoved.length > 0) {
    reasons.push({ tag: 'Vehicle Removed', detail: vehiclesRemoved.length > 1 ? `${vehiclesRemoved.length} vehicles` : vehiclesRemoved[0].description, color: 'green' });
  }

  const driversAdded = materialChanges.filter(m => m.category === 'driver_added');
  const driversRemoved = materialChanges.filter(m => m.category === 'driver_removed');
  if (driversAdded.length > 0) {
    const hasYoung = driversAdded.some(m => {
      const addedName = m.description?.toLowerCase() || '';
      const driver = renewalSnapshot?.drivers?.find(d =>
        d.name?.toLowerCase().includes(addedName.split(' ')[0] || '') && d.dateOfBirth
      );
      if (driver?.dateOfBirth) {
        const age = Math.floor((Date.now() - new Date(driver.dateOfBirth).getTime()) / (365.25 * 86400000));
        return age < 26;
      }
      return false;
    });
    if (hasYoung) {
      reasons.push({ tag: 'Young Driver Added', color: 'red' });
    } else {
      reasons.push({ tag: 'Driver Added', detail: driversAdded.length > 1 ? `${driversAdded.length} drivers` : driversAdded[0].description, color: 'amber' });
    }
  }
  if (driversRemoved.length > 0) {
    reasons.push({ tag: 'Driver Removed', detail: driversRemoved.length > 1 ? `${driversRemoved.length} drivers` : driversRemoved[0].description, color: 'amber' });
  }

  const discountsRemoved = materialChanges.filter(m => m.category === 'discount_removed');
  const discountsAdded = materialChanges.filter(m => m.category === 'discount_added');
  if (discountsRemoved.length > 0) {
    reasons.push({ tag: 'Discount Removed', detail: discountsRemoved.length > 1 ? `${discountsRemoved.length} discounts` : discountsRemoved[0].description, color: 'red' });
  }
  if (discountsAdded.length > 0) {
    reasons.push({ tag: 'Discount Added', detail: discountsAdded.length > 1 ? `${discountsAdded.length} discounts` : discountsAdded[0].description, color: 'green' });
  }

  if (isHome) {
    const dwellingLimitChange = materialChanges.find(m =>
      m.category === 'coverage_limit' &&
      (m.field?.toLowerCase().includes('dwelling') || m.field?.toLowerCase().includes('cov a'))
    );
    const dwellingCheck = checkResults.find(r =>
      (r.ruleId === 'H-046' || r.field?.toLowerCase().includes('dwelling')) &&
      r.severity !== 'unchanged' && r.change !== 'No change'
    );
    if (dwellingLimitChange && (dwellingLimitChange.changeAmount ?? 0) > 0) {
      reasons.push({ tag: 'Inflation Guard', color: 'amber' });
    } else if (dwellingCheck && dwellingCheck.severity !== 'unchanged') {
      if ((dwellingCheck.change || '').includes('+')) {
        reasons.push({ tag: 'Inflation Guard', color: 'amber' });
      }
    }
  }

  const coveragesRemoved = materialChanges.filter(m => m.category === 'coverage_removed');
  const coveragesAdded = materialChanges.filter(m => m.category === 'coverage_added');
  const coverageLimits = materialChanges.filter(m => m.category === 'coverage_limit');
  if (coveragesRemoved.length > 0) {
    reasons.push({ tag: 'Coverage Removed', detail: coveragesRemoved.length > 1 ? `${coveragesRemoved.length} coverages` : coveragesRemoved[0].description, color: 'red' });
  }
  if (coveragesAdded.length > 0) {
    reasons.push({ tag: 'Coverage Added', detail: coveragesAdded.length > 1 ? `${coveragesAdded.length} coverages` : coveragesAdded[0].description, color: 'amber' });
  }
  const nonDwellingLimitChanges = coverageLimits.filter(m =>
    !m.field?.toLowerCase().includes('dwelling') && !m.field?.toLowerCase().includes('cov a')
  );
  if (nonDwellingLimitChanges.length > 0) {
    reasons.push({ tag: 'Coverage Limits Changed', detail: nonDwellingLimitChanges.length > 1 ? `${nonDwellingLimitChanges.length} coverages` : nonDwellingLimitChanges[0].description, color: 'amber' });
  }

  const deductibleChanges = materialChanges.filter(m => m.category === 'deductible');
  if (deductibleChanges.length > 0) {
    reasons.push({ tag: 'Deductible Changed', detail: deductibleChanges.length > 1 ? `${deductibleChanges.length} deductibles` : deductibleChanges[0].description, color: 'amber' });
  }

  const claimChanges = materialChanges.filter(m => m.category === 'claim');
  if (claimChanges.length > 0) {
    reasons.push({ tag: 'New Claim', detail: claimChanges.length > 1 ? `${claimChanges.length} claims` : claimChanges[0].description, color: 'red' });
  }

  if (isHome) {
    const roofCheck = checkResults.find(r =>
      r.ruleId === 'H-043' && (r.severity === 'critical' || r.severity === 'warning')
    );
    if (roofCheck) {
      reasons.push({ tag: 'Property Concern', detail: roofCheck.message, color: 'red' });
    }
  }

  const endorsementChanges = materialChanges.filter(m =>
    m.category === 'endorsement_removed' || m.category === 'endorsement_added' || m.category === 'endorsement'
  );
  if (endorsementChanges.length > 0) {
    reasons.push({ tag: 'Endorsement Changed', detail: endorsementChanges.length > 1 ? `${endorsementChanges.length} endorsements` : endorsementChanges[0].description, color: 'amber' });
  }

  if (reasons.length === 0) {
    const pct = premiumChangePercent ?? 0;
    if (pct > 0) {
      reasons.push({ tag: 'Rate Increase', color: 'red' });
    } else if (pct < 0) {
      reasons.push({ tag: 'Rate Decrease', color: 'green' });
    } else {
      reasons.push({ tag: 'Rate Adjustment', color: 'gray' });
    }
  }

  return reasons;
}

// ---- Main ----

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { desc, not, eq } = await import('drizzle-orm');

  const rows = await db
    .select()
    .from(renewalComparisons)
    .where(not(eq(renewalComparisons.status, 'archived')))
    .orderBy(desc(renewalComparisons.updatedAt))
    .limit(100);

  console.log(`Inspecting ${rows.length} renewals...\n`);

  const tagCounts: Record<string, number> = {};

  for (const row of rows) {
    const materialChanges = (row.materialChanges || []) as unknown as MaterialChange[];
    const checkResults = (row.checkResults || []) as unknown as CheckResult[];
    const renewalSnapshot = row.renewalSnapshot as unknown as RenewalSnapshot | null;
    const baselineSnapshot = row.baselineSnapshot as unknown as BaselineSnapshot | null;
    const pct = row.premiumChangePercent ? Number(row.premiumChangePercent) : null;

    const reasons = analyzeReasons(
      materialChanges,
      checkResults,
      renewalSnapshot,
      baselineSnapshot,
      pct,
      row.lineOfBusiness,
    );

    const tags = reasons.map(r => r.tag).join(', ');
    for (const r of reasons) {
      tagCounts[r.tag] = (tagCounts[r.tag] || 0) + 1;
    }

    const pctStr = pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : 'N/A';
    const amtStr = row.premiumChangeAmount ? `$${Math.abs(Number(row.premiumChangeAmount)).toFixed(0)}` : '';

    console.log(`${row.policyNumber?.padEnd(20)} ${row.carrierName?.padEnd(15) || ''.padEnd(15)} ${pctStr.padStart(8)} ${amtStr.padStart(8)}  →  ${tags}`);

    // Show details for each reason
    for (const r of reasons) {
      if (r.detail) {
        console.log(`    ${r.tag}: ${r.detail}`);
      }
    }
  }

  console.log('\n\n=== TAG DISTRIBUTION ===');
  const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted) {
    console.log(`  ${tag.padEnd(25)} ${count}`);
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
