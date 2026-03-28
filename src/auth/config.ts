/**
 * Auth configuration for Supabase OAuth integration.
 *
 * All values are environment-configurable. No hardcoded defaults --
 * each deployment must provide its own Supabase project credentials.
 */

// Supabase JWKS endpoint - contains ES256 public key for JWT verification
export const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL!;

// Issuer claim in Supabase JWTs
export const SUPABASE_ISSUER = process.env.SUPABASE_ISSUER!;

// Resource identifier for this MCP server (RFC 9728)
export const MCP_RESOURCE_IDENTIFIER =
  process.env.MCP_RESOURCE_IDENTIFIER || '{{MCP_RESOURCE_ID}}';

// Well-known path for Protected Resource Metadata (RFC 9728)
export const PROTECTED_RESOURCE_METADATA_PATH =
  '/.well-known/oauth-protected-resource';
