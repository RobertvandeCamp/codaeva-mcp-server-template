/**
 * Auth configuration for Supabase OAuth integration.
 *
 * JWKS URL and issuer are derived from SUPABASE_URL (validated in data-access/config.ts).
 * This avoids separate env vars and ensures consistency.
 */

import { getConfig as getDataAccessConfig } from '../data-access/config.js';

/**
 * Derive the Supabase project ref from SUPABASE_URL.
 * e.g. "https://abcdefg.supabase.co" -> "abcdefg"
 */
function getSupabaseRef(): string {
  const supabaseUrl = getDataAccessConfig().SUPABASE_URL;
  return new URL(supabaseUrl).hostname.split('.')[0];
}

/** Supabase JWKS endpoint - contains ES256 public key for JWT verification */
export function getSupabaseJwksUrl(): string {
  return `https://${getSupabaseRef()}.supabase.co/auth/v1/.well-known/jwks.json`;
}

/** Issuer claim in Supabase JWTs */
export function getSupabaseIssuer(): string {
  return `https://${getSupabaseRef()}.supabase.co/auth/v1`;
}

// Resource identifier for this MCP server (RFC 9728)
export const MCP_RESOURCE_IDENTIFIER =
  process.env.MCP_RESOURCE_IDENTIFIER || '{{MCP_RESOURCE_ID}}';

// Well-known path for Protected Resource Metadata (RFC 9728)
export const PROTECTED_RESOURCE_METADATA_PATH =
  '/.well-known/oauth-protected-resource';
