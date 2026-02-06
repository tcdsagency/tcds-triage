import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

import { compareSnapshots } from '../src/lib/al3/comparison-engine';

// Test data matching the watercraft case
const renewalSnapshot = {
  premium: 430,
  coverages: [],
  vehicles: [],
  drivers: [],
  endorsements: [],
  discounts: [],
  claims: [],
  parseConfidence: 0.9,
  parsedAt: new Date().toISOString()
};

const baselineSnapshot = {
  premium: 441,
  coverages: [],
  vehicles: [],
  drivers: [],
  endorsements: [],
  discounts: [
    { code: 'HOMEOWNER_DISCOUNT', description: 'Homeowner Discount' },
    { code: 'AUTO_PAY_DISCOUNT', description: 'Preferred Payment Discount' }
  ],
  claims: [],
  policyEffectiveDate: '2025-03-17',
  policyExpirationDate: '2026-03-17',
  fetchedAt: new Date().toISOString(),
  fetchSource: 'hawksoft_api' as const
};

const result = compareSnapshots(renewalSnapshot, baselineSnapshot, undefined, '2026-03-17');

console.log('Comparison result:');
console.log('  baselineStatus:', result.baselineStatus);
console.log('  baselineStatusReason:', result.baselineStatusReason);
console.log('  recommendation:', result.recommendation);
console.log('  material negatives:', result.materialChanges.filter(c => c.severity === 'material_negative').length);

// Show what gets into the summary
console.log('\nSummary object:');
console.log(JSON.stringify(result.summary, null, 2));
