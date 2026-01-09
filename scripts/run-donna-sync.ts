/**
 * Run full Donna AI sync for all customers
 */
import { syncFromDonna } from '../src/lib/api/donna-sync';

const TENANT_ID = process.env.DEFAULT_TENANT_ID || '062c4693-96b2-4000-814b-04c2a334ebeb';

async function main() {
  console.log('=== Running Full Donna AI Sync ===\n');
  console.log('Tenant ID:', TENANT_ID);
  console.log('Started at:', new Date().toISOString());
  console.log('');

  try {
    const limit = parseInt(process.argv[2] || '10');
    console.log('Limit:', limit, 'customers\n');

    const result = await syncFromDonna({
      tenantId: TENANT_ID,
      fullSync: true,  // Sync all records regardless of stale threshold
      batchSize: 25,
      staleThresholdHours: 0,  // Force refresh all
      maxRecords: limit,
    });

    console.log('\n=== Sync Complete ===');
    console.log('Duration:', (result.duration / 1000).toFixed(1), 'seconds');
    console.log('Total processed:', result.total);
    console.log('Synced:', result.synced);
    console.log('Skipped:', result.skipped);
    console.log('Not found in Donna:', result.notFound);
    console.log('Errors:', result.errors);

    if (result.errors > 0) {
      console.log('\n⚠️  Some records had errors');
    } else {
      console.log('\n✅ Sync completed successfully!');
    }
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

main();
