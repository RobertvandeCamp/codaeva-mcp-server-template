/**
 * JWKS singleton with caching via jose's createRemoteJWKSet.
 *
 * jose's createRemoteJWKSet has built-in caching:
 * - 10 minute cache TTL
 * - 30 second cooldown between fetches
 * - Automatic refresh on key rotation
 */

import { createRemoteJWKSet } from 'jose';
import { getSupabaseJwksUrl } from './config.js';

/**
 * Lazy-initialized JWKS singleton.
 * Created on first use, reused for all subsequent validations.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Get the JWKS for token validation.
 *
 * Uses lazy initialization - the JWKS URL is only fetched on first use.
 * Subsequent calls return the cached instance with jose's built-in
 * cache management.
 */
export function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(getSupabaseJwksUrl()));
  }
  return jwks;
}

/**
 * Reset the JWKS singleton (for testing purposes only).
 */
export function resetJWKS(): void {
  jwks = null;
}
