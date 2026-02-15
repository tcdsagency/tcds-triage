import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

async function main() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  console.log('Running migration: 0013_add_weather_alerts...');

  const migrationSql = fs.readFileSync(
    path.resolve(__dirname, '../src/db/migrations/0013_add_weather_alerts.sql'),
    'utf8'
  );

  // Split by semicolons and execute each statement
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
      console.log('  OK:', stmt.substring(0, 70).replace(/\n/g, ' '));
    } catch (err: any) {
      console.error('  ERR:', err.message, '|', stmt.substring(0, 60).replace(/\n/g, ' '));
    }
  }

  console.log('Migration complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
