import { z } from 'zod';

// SUPABASE_ANON_KEY is the Supabase anon/public key (safe to expose, RLS enforced).
// Used as the base key for Supabase clients. Per-user JWT tokens override the auth context.
// SUPABASE_SERVICE_KEY is optional -- only needed for dev mode (bypasses RLS).
// LOG_LEVEL is validated in src/config.ts -- not duplicated here
const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

let config: Config | null = null;

export function getConfig(): Config {
  if (config) return config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }

  config = result.data;
  return config;
}
