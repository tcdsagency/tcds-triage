require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function enable() {
  const tenantId = process.env.DEFAULT_TENANT_ID;

  // Get current features
  const [tenant] = await sql`
    SELECT features FROM tenants WHERE id = ${tenantId}
  `;

  // Parse features if it's a string
  let features = tenant.features;
  if (typeof features === 'string') {
    features = JSON.parse(features);
  }

  console.log('Current features:', JSON.stringify(features, null, 2));

  // Add autoCreateServiceTickets feature
  features.autoCreateServiceTickets = true;

  // Update using SQL jsonb operations
  await sql`
    UPDATE tenants
    SET features = ${sql.json(features)}
    WHERE id = ${tenantId}
  `;

  // Verify
  const [updated] = await sql`
    SELECT features FROM tenants WHERE id = ${tenantId}
  `;

  let updatedFeatures = updated.features;
  if (typeof updatedFeatures === 'string') {
    updatedFeatures = JSON.parse(updatedFeatures);
  }

  console.log('\nUpdated features:', JSON.stringify(updatedFeatures, null, 2));
  console.log('\nautoCreateServiceTickets:', updatedFeatures.autoCreateServiceTickets);

  await sql.end();
}

enable().catch(e => { console.error(e); process.exit(1); });
