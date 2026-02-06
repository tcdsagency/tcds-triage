import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function run() {
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

  console.log('Testing compare API at:', BASE_URL);

  const res = await fetch(`${BASE_URL}/api/renewals/internal/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${INTERNAL_KEY}`
    },
    body: JSON.stringify({
      renewalSnapshot: {
        premium: 963,
        coverages: [],
        vehicles: [],
        drivers: [],
        endorsements: [],
        discounts: [],
        claims: [],
        parseConfidence: 0.9,
        parsedAt: new Date().toISOString()
      },
      baselineSnapshot: {
        premium: 963,
        coverages: [],
        vehicles: [],
        drivers: [],
        endorsements: [],
        discounts: [],
        claims: [],
        policyEffectiveDate: '2026-02-05',
        policyExpirationDate: '2026-08-05',
        fetchedAt: new Date().toISOString(),
        fetchSource: 'hawksoft_api'
      },
      renewalEffectiveDate: '2026-08-05'
    })
  });

  const data = await res.json();
  console.log('\nAPI Response:');
  console.log('  success:', data.success);
  console.log('  baselineStatus:', data.result?.baselineStatus);
  console.log('  baselineStatusReason:', data.result?.baselineStatusReason);
  console.log('  recommendation:', data.result?.recommendation);
  
  console.log('\nFull result keys:', Object.keys(data.result || {}));
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
