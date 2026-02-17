/**
 * Supabase DB client for workers.
 * Used for direct table operations (e.g., dead-letter job recording).
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config';

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return client;
}
