import postgres from 'postgres';

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(connectionString, { ssl: 'require' });

  try {
    console.log('Running Donna columns migration...');

    // Add donna_data column
    await sql`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS donna_data jsonb
    `;
    console.log('✓ Added donna_data column');

    // Add last_synced_from_donna column
    await sql`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS last_synced_from_donna timestamp
    `;
    console.log('✓ Added last_synced_from_donna column');

    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_customers_donna_sync
      ON customers (tenant_id, last_synced_from_donna)
      WHERE donna_data IS NOT NULL
    `;
    console.log('✓ Created index idx_customers_donna_sync');

    // Add comments
    await sql`
      COMMENT ON COLUMN customers.donna_data IS 'Donna AI (AgencyIQ/Crux) customer insights including sentiment, predictions, and recommendations'
    `;
    await sql`
      COMMENT ON COLUMN customers.last_synced_from_donna IS 'Timestamp of last successful sync from Donna AI'
    `;
    console.log('✓ Added column comments');

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
