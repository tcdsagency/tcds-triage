import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');
  const { eq, desc } = await import('drizzle-orm');

  const rows = await db.select().from(renewalComparisons)
    .where(eq(renewalComparisons.policyNumber, '978592726'))
    .orderBy(desc(renewalComparisons.createdAt))
    .limit(1);

  if (!rows.length) {
    console.log('No renewal found for policy 978592726');
    process.exit(1);
  }

  const c = rows[0];

  console.log('='.repeat(80));
  console.log('RENEWAL COMPARISON RECORD');
  console.log('='.repeat(80));
  console.log('id:', c.id);
  console.log('policyNumber:', c.policyNumber);
  console.log('carrierName:', c.carrierName);
  console.log('lineOfBusiness:', c.lineOfBusiness);
  console.log('status:', c.status);
  console.log('recommendation:', c.recommendation);
  console.log('renewalEffectiveDate:', c.renewalEffectiveDate);
  console.log('currentPremium:', c.currentPremium);
  console.log('renewalPremium:', c.renewalPremium);
  console.log('premiumChangeAmount:', c.premiumChangeAmount);
  console.log('premiumChangePercent:', c.premiumChangePercent);
  console.log('createdAt:', c.createdAt);

  console.log('\n' + '-'.repeat(80));
  console.log('COMPARISON SUMMARY');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(c.comparisonSummary, null, 2));

  console.log('\n' + '-'.repeat(80));
  console.log('MATERIAL CHANGES');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(c.materialChanges, null, 2));

  console.log('\n' + '-'.repeat(80));
  console.log('CHECK RESULTS');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(c.checkResults, null, 2));

  console.log('\n' + '-'.repeat(80));
  console.log('CHECK SUMMARY');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(c.checkSummary, null, 2));

  const rs = c.renewalSnapshot as any;
  console.log('\n' + '='.repeat(80));
  console.log('RENEWAL SNAPSHOT');
  console.log('='.repeat(80));
  if (!rs) {
    console.log('(null)');
  } else {
    console.log('Top-level keys:', Object.keys(rs).join(', '));
    console.log('insuredName:', rs.insuredName);
    console.log('premium:', rs.premium);
    console.log('parseConfidence:', rs.parseConfidence);
    console.log('policyEffectiveDate:', rs.policyEffectiveDate);
    console.log('policyExpirationDate:', rs.policyExpirationDate);

    const rCovs = rs.coverages || [];
    console.log('\nRenewal Coverages (' + rCovs.length + '):');
    for (const cov of rCovs) {
      const dd = cov.deductibleAmount ?? cov.deductible ?? '-';
      const ll = cov.limitAmount ?? cov.limit ?? '-';
      console.log('  ' + cov.type + ': limit=' + ll + ', ded=' + dd + ', prem=' + (cov.premium ?? '-'));
      console.log('    keys: ' + Object.keys(cov).join(', '));
    }

    const rVehs = rs.vehicles || [];
    console.log('\nRenewal Vehicles (' + rVehs.length + '):');
    for (const v of rVehs) {
      console.log('  ' + (v.year||'') + ' ' + (v.make||'') + ' ' + (v.model||'') + ' VIN:' + (v.vin || 'n/a'));
      console.log('    vehicle keys: ' + Object.keys(v).join(', '));
      const vCovs = v.coverages || [];
      console.log('    Coverages (' + vCovs.length + '):');
      for (const vc of vCovs) {
        const vd = vc.deductibleAmount ?? vc.deductible ?? '-';
        const vl = vc.limitAmount ?? vc.limit ?? '-';
        console.log('      ' + vc.type + ': limit=' + vl + ', ded=' + vd + ', prem=' + (vc.premium ?? '-'));
        console.log('        keys: ' + Object.keys(vc).join(', '));
      }
      if (v.deductibles) console.log('    Vehicle deductibles:', JSON.stringify(v.deductibles));
      if (v.deductible) console.log('    Vehicle deductible:', v.deductible);
    }

    const rDr = rs.drivers || [];
    console.log('\nRenewal Drivers (' + rDr.length + '):');
    for (const dd2 of rDr) console.log('  ' + JSON.stringify(dd2));

    const rDisc = rs.discounts || [];
    console.log('\nRenewal Discounts (' + rDisc.length + '):');
    for (const dd3 of rDisc) console.log('  ' + (dd3.code || dd3.type) + ': ' + (dd3.description || '-'));

    if (rs.deductibles) console.log('\nRoot deductibles:', JSON.stringify(rs.deductibles, null, 2));
  }

  const bs = c.baselineSnapshot as any;
  console.log('\n' + '='.repeat(80));
  console.log('BASELINE SNAPSHOT');
  console.log('='.repeat(80));
  if (!bs) {
    console.log('(null)');
  } else {
    console.log('Top-level keys:', Object.keys(bs).join(', '));
    console.log('fetchSource:', bs.fetchSource);
    console.log('premium:', bs.premium);
    console.log('insuredName:', bs.insuredName);
    console.log('policyEffectiveDate:', bs.policyEffectiveDate);
    console.log('policyExpirationDate:', bs.policyExpirationDate);

    const bCovs = bs.coverages || [];
    console.log('\nBaseline Coverages (' + bCovs.length + '):');
    for (const cov of bCovs) {
      const dd = cov.deductibleAmount ?? cov.deductible ?? '-';
      const ll = cov.limitAmount ?? cov.limit ?? '-';
      console.log('  ' + cov.type + ': limit=' + ll + ', ded=' + dd + ', prem=' + (cov.premium ?? '-'));
      console.log('    keys: ' + Object.keys(cov).join(', '));
    }

    const bVehs = bs.vehicles || [];
    console.log('\nBaseline Vehicles (' + bVehs.length + '):');
    for (const v of bVehs) {
      console.log('  ' + (v.year||'') + ' ' + (v.make||'') + ' ' + (v.model||'') + ' VIN:' + (v.vin || 'n/a'));
      console.log('    vehicle keys: ' + Object.keys(v).join(', '));
      const vCovs = v.coverages || [];
      console.log('    Coverages (' + vCovs.length + '):');
      for (const vc of vCovs) {
        const vd = vc.deductibleAmount ?? vc.deductible ?? '-';
        const vl = vc.limitAmount ?? vc.limit ?? '-';
        console.log('      ' + vc.type + ': limit=' + vl + ', ded=' + vd + ', prem=' + (vc.premium ?? '-'));
        console.log('        keys: ' + Object.keys(vc).join(', '));
      }
      if (v.deductibles) console.log('    Vehicle deductibles:', JSON.stringify(v.deductibles));
      if (v.deductible) console.log('    Vehicle deductible:', v.deductible);
    }

    const bDr = bs.drivers || [];
    console.log('\nBaseline Drivers (' + bDr.length + '):');
    for (const dd2 of bDr) console.log('  ' + JSON.stringify(dd2));

    const bDisc = bs.discounts || [];
    console.log('\nBaseline Discounts (' + bDisc.length + '):');
    for (const dd3 of bDisc) console.log('  ' + (dd3.code || dd3.type) + ': ' + (dd3.description || '-'));

    if (bs.deductibles) console.log('\nRoot deductibles:', JSON.stringify(bs.deductibles, null, 2));
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
