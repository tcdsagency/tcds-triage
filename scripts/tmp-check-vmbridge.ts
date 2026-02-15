import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
  const { db } = await import('../src/db');
  const { tenants } = await import('../src/db/schema');

  const allTenants = await db.select({ id: tenants.id, name: tenants.name, integrations: tenants.integrations }).from(tenants);

  for (const t of allTenants) {
    console.log(`Tenant: ${t.name} (${t.id})`);
    const integrations = (t.integrations as Record<string, any>) || {};
    console.log('  vmbridge config:', JSON.stringify(integrations.vmbridge || 'NOT SET'));
    console.log('  deepgram config:', JSON.stringify(integrations.deepgram || 'NOT SET'));
    console.log('  voiptools config:', JSON.stringify(integrations.voiptools || 'NOT SET'));
  }

  // Try to get VM Bridge client
  const { getVMBridgeClient } = await import('../src/lib/api/vm-bridge');
  const client = await getVMBridgeClient();
  if (client) {
    console.log('\nVM Bridge client: CONFIGURED');
    console.log('  URL:', client.getBridgeUrl());
    console.log('  isConfigured:', client.isConfigured());
  } else {
    console.log('\nVM Bridge client: NULL (not configured)');
    console.log('  VMBRIDGE_URL env:', process.env.VMBRIDGE_URL || 'NOT SET');
    console.log('  DEEPGRAM_API_KEY env:', process.env.DEEPGRAM_API_KEY ? 'SET' : 'NOT SET');
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
