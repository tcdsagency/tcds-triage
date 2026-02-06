/**
 * AL3 Parsing Diagnostic Script
 * ==============================
 * Audits renewal comparisons to identify parsing issues.
 * Run with: npx tsx scripts/diagnose-parsing.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

interface Coverage {
  type: string;
  description?: string;
  limit?: string;
  limitAmount?: number;
  deductible?: string;
  deductibleAmount?: number;
  premium?: number;
}

interface Vehicle {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  coverages?: Coverage[];
}

interface Driver {
  name?: string;
  dateOfBirth?: string;
  licenseNumber?: string;
  licenseState?: string;
  relationship?: string;
  isExcluded?: boolean;
}

interface Discount {
  code: string;
  description?: string;
  amount?: number;
  percent?: number;
}

interface Snapshot {
  premium?: number;
  coverages?: Coverage[];
  vehicles?: Vehicle[];
  drivers?: Driver[];
  discounts?: Discount[];
}

interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  details?: any;
}

async function run() {
  const { db } = await import('../src/db');
  const { renewalComparisons } = await import('../src/db/schema');

  console.log('='.repeat(80));
  console.log('AL3 PARSING DIAGNOSTIC REPORT');
  console.log('='.repeat(80));
  console.log(`Generated: ${new Date().toISOString()}\n`);

  const comparisons = await db.select({
    id: renewalComparisons.id,
    policyNumber: renewalComparisons.policyNumber,
    carrierName: renewalComparisons.carrierName,
    lineOfBusiness: renewalComparisons.lineOfBusiness,
    currentPremium: renewalComparisons.currentPremium,
    renewalPremium: renewalComparisons.renewalPremium,
    renewalSnapshot: renewalComparisons.renewalSnapshot,
    baselineSnapshot: renewalComparisons.baselineSnapshot,
    materialChanges: renewalComparisons.materialChanges,
  }).from(renewalComparisons);

  console.log(`Found ${comparisons.length} comparisons to analyze.\n`);

  let totalIssues = 0;
  let errorCount = 0;
  let warningCount = 0;

  for (const comp of comparisons) {
    const renewal = comp.renewalSnapshot as Snapshot | null;
    const baseline = comp.baselineSnapshot as Snapshot | null;
    const issues: DiagnosticIssue[] = [];

    console.log('-'.repeat(80));
    console.log(`POLICY: ${comp.policyNumber} | ${comp.carrierName} | ${comp.lineOfBusiness}`);
    console.log('-'.repeat(80));

    // === PREMIUM ANALYSIS ===
    analyzePremium(comp, renewal, baseline, issues);

    // === COVERAGE ANALYSIS ===
    analyzeCoverages(renewal, baseline, issues);

    // === VEHICLE ANALYSIS ===
    analyzeVehicles(renewal, baseline, issues);

    // === DRIVER ANALYSIS ===
    analyzeDrivers(renewal, baseline, issues);

    // === DEDUCTIBLE ANALYSIS ===
    analyzeDeductibles(renewal, baseline, issues);

    // === DISCOUNT ANALYSIS ===
    analyzeDiscounts(renewal, baseline, issues);

    // === REPORT ISSUES ===
    if (issues.length === 0) {
      console.log('  ✅ No issues detected\n');
    } else {
      for (const issue of issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} [${issue.category}] ${issue.message}`);
        if (issue.details) {
          console.log(`     Details: ${JSON.stringify(issue.details)}`);
        }
        if (issue.severity === 'error') errorCount++;
        if (issue.severity === 'warning') warningCount++;
      }
      console.log('');
      totalIssues += issues.length;
    }

    // === DETAILED BREAKDOWN ===
    printDetailedBreakdown(renewal, baseline);
  }

  // === SUMMARY ===
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Comparisons: ${comparisons.length}`);
  console.log(`Total Issues: ${totalIssues}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Warnings: ${warningCount}`);
  console.log(`  Info: ${totalIssues - errorCount - warningCount}`);

  if (errorCount > 0) {
    console.log('\n⚠️  ATTENTION: There are parsing errors that need investigation.');
  } else if (warningCount > 0) {
    console.log('\n✓ No critical errors, but some warnings to review.');
  } else {
    console.log('\n✅ All comparisons look good!');
  }

  process.exit(0);
}

function analyzePremium(
  comp: any,
  renewal: Snapshot | null,
  baseline: Snapshot | null,
  issues: DiagnosticIssue[]
) {
  // Check if premiums match stored values
  if (renewal?.premium !== undefined && comp.renewalPremium !== undefined) {
    const stored = parseFloat(comp.renewalPremium);
    if (Math.abs(renewal.premium - stored) > 1) {
      issues.push({
        severity: 'warning',
        category: 'PREMIUM',
        message: `Renewal premium mismatch: snapshot=${renewal.premium}, stored=${stored}`,
      });
    }
  }

  // Check if current = renewal (baseline issue)
  if (comp.currentPremium && comp.renewalPremium) {
    const current = parseFloat(comp.currentPremium);
    const renewalPrem = parseFloat(comp.renewalPremium);
    if (current === renewalPrem && current > 0) {
      issues.push({
        severity: 'warning',
        category: 'BASELINE',
        message: `Current premium equals renewal premium ($${current}) - baseline may be stale`,
      });
    }
  }

  // Check for zero or missing premium
  if (!renewal?.premium || renewal.premium === 0) {
    issues.push({
      severity: 'error',
      category: 'PREMIUM',
      message: 'Renewal premium is zero or missing',
    });
  }

  // Validate premium calculation from coverages
  if (renewal?.coverages || renewal?.vehicles) {
    let calculatedPremium = 0;

    // Sum policy-level coverages
    for (const cov of renewal.coverages || []) {
      calculatedPremium += cov.premium || 0;
    }

    // Sum vehicle-level coverages
    for (const veh of renewal.vehicles || []) {
      for (const cov of veh.coverages || []) {
        calculatedPremium += cov.premium || 0;
      }
    }

    if (calculatedPremium > 0 && renewal.premium) {
      const diff = Math.abs(calculatedPremium - renewal.premium);
      if (diff > 10) {
        issues.push({
          severity: 'warning',
          category: 'PREMIUM',
          message: `Premium calculation mismatch: sum=${calculatedPremium}, stored=${renewal.premium}, diff=${diff}`,
        });
      }
    }
  }
}

function analyzeCoverages(
  renewal: Snapshot | null,
  baseline: Snapshot | null,
  issues: DiagnosticIssue[]
) {
  const renewalCovs = renewal?.coverages || [];
  const baselineCovs = baseline?.coverages || [];

  // Check for coverages with no premium and no limit (potentially empty)
  for (const cov of renewalCovs) {
    if (!cov.premium && !cov.limitAmount && !cov.deductibleAmount) {
      issues.push({
        severity: 'info',
        category: 'COVERAGE',
        message: `Empty coverage: ${cov.type} (${cov.description || 'no desc'})`,
      });
    }
  }

  // Check for unknown coverage types
  const knownTypes = new Set([
    'bodily_injury', 'property_damage', 'comprehensive', 'collision',
    'uninsured_motorist', 'underinsured_motorist', 'medical_payments',
    'pip', 'tl', 'rreim', 'rental_reimbursement', 'towing', 'gap_coverage',
    'combined_single_limit', 'personal_injury_protection',
  ]);

  for (const cov of renewalCovs) {
    if (cov.type && !knownTypes.has(cov.type) && !cov.type.includes('discount')) {
      issues.push({
        severity: 'info',
        category: 'COVERAGE',
        message: `Unknown coverage type: ${cov.type}`,
      });
    }
  }

  // Check for limit format issues
  for (const cov of renewalCovs) {
    if (cov.limit && /^0+\d/.test(cov.limit)) {
      issues.push({
        severity: 'info',
        category: 'LIMIT_FORMAT',
        message: `Zero-padded limit string: ${cov.type} = "${cov.limit}"`,
      });
    }
  }
}

function analyzeVehicles(
  renewal: Snapshot | null,
  baseline: Snapshot | null,
  issues: DiagnosticIssue[]
) {
  const renewalVehs = renewal?.vehicles || [];
  const baselineVehs = baseline?.vehicles || [];

  // Check for vehicles without VIN
  for (const veh of renewalVehs) {
    if (!veh.vin) {
      issues.push({
        severity: 'warning',
        category: 'VEHICLE',
        message: `Vehicle without VIN: ${veh.year} ${veh.make} ${veh.model}`,
      });
    }
  }

  // Check for vehicles with no coverages
  for (const veh of renewalVehs) {
    if (!veh.coverages || veh.coverages.length === 0) {
      issues.push({
        severity: 'warning',
        category: 'VEHICLE',
        message: `Vehicle with no coverages: ${veh.year} ${veh.make} ${veh.model}`,
      });
    }
  }

  // Check for duplicate VINs
  const vins = renewalVehs.map(v => v.vin).filter(Boolean);
  const uniqueVins = new Set(vins);
  if (vins.length !== uniqueVins.size) {
    issues.push({
      severity: 'warning',
      category: 'VEHICLE',
      message: `Duplicate VINs detected in renewal`,
    });
  }

  // Check vehicle matching between baseline and renewal
  const baselineVinSet = new Set(baselineVehs.map(v => v.vin).filter(Boolean));
  const renewalVinSet = new Set(renewalVehs.map(v => v.vin).filter(Boolean));

  for (const vin of baselineVinSet) {
    if (!renewalVinSet.has(vin)) {
      const veh = baselineVehs.find(v => v.vin === vin);
      // This is expected for removed vehicles, just info
    }
  }
}

function analyzeDrivers(
  renewal: Snapshot | null,
  baseline: Snapshot | null,
  issues: DiagnosticIssue[]
) {
  const renewalDrivers = renewal?.drivers || [];
  const baselineDrivers = baseline?.drivers || [];

  // Check for drivers without names
  for (const drv of renewalDrivers) {
    if (!drv.name || drv.name.trim() === '') {
      issues.push({
        severity: 'warning',
        category: 'DRIVER',
        message: 'Driver with empty name',
      });
    }
  }

  // Check for drivers without DOB (can't calculate age)
  for (const drv of renewalDrivers) {
    if (!drv.dateOfBirth) {
      issues.push({
        severity: 'info',
        category: 'DRIVER',
        message: `Driver without DOB: ${drv.name}`,
      });
    }
  }
}

function analyzeDeductibles(
  renewal: Snapshot | null,
  baseline: Snapshot | null,
  issues: DiagnosticIssue[]
) {
  // Check vehicle-level coverages for deductibles
  for (const veh of renewal?.vehicles || []) {
    for (const cov of veh.coverages || []) {
      // Comp and collision should have deductibles
      if (['comprehensive', 'collision'].includes(cov.type)) {
        if (!cov.deductibleAmount && cov.premium && cov.premium > 0) {
          issues.push({
            severity: 'warning',
            category: 'DEDUCTIBLE',
            message: `${cov.type} has premium ($${cov.premium}) but no deductible - ${veh.year} ${veh.make}`,
          });
        }
      }
    }
  }

  // Check for deductible parsing issues (raw strings)
  for (const veh of renewal?.vehicles || []) {
    for (const cov of veh.coverages || []) {
      if (cov.deductible && !cov.deductibleAmount) {
        issues.push({
          severity: 'warning',
          category: 'DEDUCTIBLE',
          message: `Deductible string not parsed: ${cov.type} = "${cov.deductible}"`,
        });
      }
    }
  }
}

function analyzeDiscounts(
  renewal: Snapshot | null,
  baseline: Snapshot | null,
  issues: DiagnosticIssue[]
) {
  const renewalDiscounts = renewal?.discounts || [];
  const baselineDiscounts = baseline?.discounts || [];

  // Check if discounts were captured
  if (renewalDiscounts.length === 0 && baselineDiscounts.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'DISCOUNT',
      message: `Baseline has ${baselineDiscounts.length} discounts but renewal has none`,
    });
  }
}

function printDetailedBreakdown(renewal: Snapshot | null, baseline: Snapshot | null) {
  console.log('\n  DETAILED BREAKDOWN:');

  // Premium
  console.log(`    Premium: Baseline=$${baseline?.premium || 'N/A'} | Renewal=$${renewal?.premium || 'N/A'}`);

  // Vehicles
  console.log(`    Vehicles: Baseline=${baseline?.vehicles?.length || 0} | Renewal=${renewal?.vehicles?.length || 0}`);

  // Drivers
  console.log(`    Drivers: Baseline=${baseline?.drivers?.length || 0} | Renewal=${renewal?.drivers?.length || 0}`);

  // Policy-level coverages
  console.log(`    Policy Coverages: Baseline=${baseline?.coverages?.length || 0} | Renewal=${renewal?.coverages?.length || 0}`);

  // Discounts
  console.log(`    Discounts: Baseline=${baseline?.discounts?.length || 0} | Renewal=${renewal?.discounts?.length || 0}`);

  // Vehicle coverage summary
  if (renewal?.vehicles?.length) {
    console.log('\n    VEHICLE COVERAGES:');
    for (const veh of renewal.vehicles) {
      const covCount = veh.coverages?.length || 0;
      const totalPrem = veh.coverages?.reduce((sum, c) => sum + (c.premium || 0), 0) || 0;
      console.log(`      ${veh.year} ${veh.make} ${veh.model}: ${covCount} coverages, $${totalPrem} premium`);

      // Show deductibles
      const compCov = veh.coverages?.find(c => c.type === 'comprehensive');
      const collCov = veh.coverages?.find(c => c.type === 'collision');
      if (compCov || collCov) {
        console.log(`        Comp ded: $${compCov?.deductibleAmount || 'N/A'} | Coll ded: $${collCov?.deductibleAmount || 'N/A'}`);
      }
    }
  }

  console.log('');
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
