import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');

  const comps = await db.select().from(renewalComparisons);

  for (const c of comps) {
    const baseline = c.baselineSnapshot as any;
    const renewal = c.renewalSnapshot as any;
    const changes = c.materialChanges as any[];
    const summary = c.comparisonSummary as any;

    console.log('='.repeat(80));
    console.log('POLICY:', c.policyNumber, '-', c.carrierName, '-', c.lineOfBusiness);
    console.log('='.repeat(80));
    console.log('Baseline Status:', summary?.baselineStatus);
    console.log('Recommendation:', c.recommendation);
    console.log('');

    // Premium
    console.log('--- PREMIUM ---');
    console.log('  Baseline:', baseline?.premium);
    console.log('  Renewal:', renewal?.premium);
    console.log('  Change:', c.premiumChangeAmount, '(', c.premiumChangePercent, '%)');
    console.log('');

    // Coverages
    console.log('--- POLICY COVERAGES ---');
    const baseCovs = baseline?.coverages || [];
    const renCovs = renewal?.coverages || [];
    const allCovTypes = new Set([...baseCovs.map((x: any) => x.type), ...renCovs.map((x: any) => x.type)]);

    for (const type of Array.from(allCovTypes).sort()) {
      const bc = baseCovs.find((x: any) => x.type === type);
      const rc = renCovs.find((x: any) => x.type === type);
      const status = bc && rc ? '  ' : bc ? 'B-' : 'R+';
      console.log('  ' + status + ' ' + type + ':');
      if (bc) console.log('      Baseline: limit=' + (bc.limitAmount || bc.limit || '-') + ', ded=' + (bc.deductibleAmount || '-') + ', prem=' + (bc.premium || '-'));
      if (rc) console.log('      Renewal:  limit=' + (rc.limitAmount || rc.limit || '-') + ', ded=' + (rc.deductibleAmount || '-') + ', prem=' + (rc.premium || '-'));
    }
    console.log('');

    // Vehicles
    console.log('--- VEHICLES ---');
    const baseVehs = baseline?.vehicles || [];
    const renVehs = renewal?.vehicles || [];
    console.log('  Baseline vehicles:', baseVehs.length);
    console.log('  Renewal vehicles:', renVehs.length);

    for (const rv of renVehs) {
      const bv = baseVehs.find((v: any) => v.vin === rv.vin);
      const vinShort = rv.vin ? rv.vin.slice(-4) : 'no VIN';
      console.log('  ' + rv.year + ' ' + rv.make + ' ' + rv.model + ' (' + vinShort + ')');
      if (bv) {
        const bCovs = bv.coverages || [];
        const rCovs = rv.coverages || [];
        for (const rc of rCovs) {
          const bc = bCovs.find((x: any) => x.type === rc.type);
          if (bc) {
            if (bc.deductibleAmount !== rc.deductibleAmount || bc.limitAmount !== rc.limitAmount || bc.premium !== rc.premium) {
              console.log('    ' + rc.type + ': base(lim=' + bc.limitAmount + ', ded=' + bc.deductibleAmount + ', prem=' + bc.premium + ') -> ren(lim=' + rc.limitAmount + ', ded=' + rc.deductibleAmount + ', prem=' + rc.premium + ')');
            }
          } else {
            console.log('    ' + rc.type + ': ADDED in renewal (lim=' + rc.limitAmount + ', ded=' + rc.deductibleAmount + ', prem=' + rc.premium + ')');
          }
        }
        for (const bc of bCovs) {
          const rc = rCovs.find((x: any) => x.type === bc.type);
          if (!rc) {
            console.log('    ' + bc.type + ': REMOVED (was lim=' + bc.limitAmount + ', ded=' + bc.deductibleAmount + ', prem=' + bc.premium + ')');
          }
        }
      } else {
        console.log('    (not in baseline - NEW VEHICLE)');
      }
    }
    for (const bv of baseVehs) {
      const rv = renVehs.find((v: any) => v.vin === bv.vin);
      if (!rv) {
        const vinShort = bv.vin ? bv.vin.slice(-4) : 'no VIN';
        console.log('  ' + bv.year + ' ' + bv.make + ' ' + bv.model + ' (' + vinShort + ') - REMOVED');
      }
    }
    console.log('');

    // Drivers
    console.log('--- DRIVERS ---');
    const baseDrvs = baseline?.drivers || [];
    const renDrvs = renewal?.drivers || [];
    const allDrivers = new Set([...baseDrvs.map((d: any) => d.name), ...renDrvs.map((d: any) => d.name)]);
    for (const name of allDrivers) {
      const bd = baseDrvs.find((d: any) => d.name === name);
      const rd = renDrvs.find((d: any) => d.name === name);
      const status = bd && rd ? '  ' : bd ? 'B-' : 'R+';
      console.log('  ' + status + ' ' + name);
    }
    console.log('');

    // Discounts
    console.log('--- DISCOUNTS ---');
    const baseDisc = baseline?.discounts || [];
    const renDisc = renewal?.discounts || [];
    const allDisc = new Set([...baseDisc.map((d: any) => d.code || d.description), ...renDisc.map((d: any) => d.code || d.description)]);
    for (const code of allDisc) {
      const bd = baseDisc.find((d: any) => (d.code || d.description) === code);
      const rd = renDisc.find((d: any) => (d.code || d.description) === code);
      const status = bd && rd ? '  ' : bd ? 'B-' : 'R+';
      const desc = bd?.description || rd?.description || '';
      console.log('  ' + status + ' ' + code + ': ' + desc);
    }
    console.log('');

    // Material Changes
    console.log('--- MATERIAL CHANGES FLAGGED ---');
    const matChanges = (changes || []).filter((ch: any) => ch.severity === 'material_negative' || ch.severity === 'material_positive');
    if (matChanges.length === 0) {
      console.log('  (none)');
    } else {
      for (const ch of matChanges) {
        console.log('  ' + ch.severity + ': ' + ch.description);
        console.log('    ' + ch.oldValue + ' -> ' + ch.newValue);
      }
    }
    console.log('');

    // Non-material changes
    const nonMat = (changes || []).filter((ch: any) => ch.severity === 'non_material');
    console.log('--- NON-MATERIAL CHANGES ---');
    if (nonMat.length === 0) {
      console.log('  (none)');
    } else {
      for (const ch of nonMat) {
        console.log('  ' + ch.category + ': ' + ch.description);
      }
    }
    console.log('\n');
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
