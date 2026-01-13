import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// For server-side use only
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set. Please configure your database connection.');
}

// Serverless-optimized connection settings for Supabase
// - prepare: false - required for Supabase transaction pooler
// - max: 1 - limit connections per serverless function instance
// - idle_timeout: 20 - close idle connections quickly
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });

// Type exports for convenience
export type Database = typeof db;
export * from './schema';
