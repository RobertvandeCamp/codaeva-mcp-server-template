import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';
import { getConfig } from './config.js';

// Schema name -- matches the Supabase schema created by infra template migrations
const SCHEMA = '{{SUPABASE_SCHEMA}}';

export type AppClient = SupabaseClient<Database, typeof SCHEMA>;

/**
 * Create a per-request Supabase client using the user's JWT access token.
 *
 * This client executes queries in the user's RLS context -- Row Level Security
 * automatically filters data based on the user's permissions in the JWT.
 *
 * Each call creates a new client (stateless, no caching).
 */
export function createUserClient(accessToken: string): AppClient {
  const config = getConfig();

  return createClient<Database, typeof SCHEMA>(
    config.SUPABASE_URL,
    config.SUPABASE_ANON_KEY,
    {
      db: { schema: SCHEMA },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
