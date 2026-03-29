/**
 * Dev mode authentication bypass for local development.
 *
 * SECURITY: Dev mode is explicitly blocked in production environments.
 * Even if AUTH_DISABLED=true is set, it will be ignored when NODE_ENV=production.
 */

import type { RequestHandler } from 'express';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
// Side-effect import to activate MCP SDK's Request.auth type extension
import '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { JwtAuthInfo } from './middleware.js';

/**
 * Check if authentication is disabled for development.
 *
 * Returns true only if:
 * - AUTH_DISABLED=true is set, AND
 * - NODE_ENV is NOT 'production'
 *
 * In production, this always returns false and logs a security error.
 */
export function isAuthDisabled(): boolean {
  const authDisabled = process.env.AUTH_DISABLED === 'true';
  const isProduction = process.env.NODE_ENV === 'production';

  if (authDisabled && isProduction) {
    console.error('SECURITY: AUTH_DISABLED=true is IGNORED in production.');
    return false;
  }

  return authDisabled;
}

/**
 * Create a fresh development user with current timestamps.
 * Timestamps are computed per-call to avoid stale iat/exp values.
 */
function createDevUser(): JwtAuthInfo {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'dev-user-local',
    role: 'authenticated',
    iat: now,
    exp: now + 86400, // 24 hours from now
  };
}

/**
 * Dev mode authentication middleware.
 *
 * Sets both req.jwtAuth (for backward compatibility) and req.auth (for MCP SDK
 * context propagation) with development user credentials.
 *
 * Should only be used when isAuthDisabled() returns true.
 */
export const devModeAuthMiddleware: RequestHandler = (req, _res, next) => {
  const devUser = createDevUser();

  // Set JWT auth info (backward compatibility)
  req.jwtAuth = devUser;

  // Set MCP SDK AuthInfo for context propagation to tools
  // In dev mode, use service_role key so Supabase client bypasses RLS
  const devToken = process.env.SUPABASE_SERVICE_KEY;
  if (!devToken) {
    throw new Error(
      'Dev mode requires SUPABASE_SERVICE_KEY to be set. ' +
      'Set SUPABASE_SERVICE_KEY in your .env file (see .env.example).',
    );
  }
  req.auth = {
    token: devToken,
    clientId: devUser.sub,
    scopes: devUser.role ? [devUser.role] : [],
    expiresAt: devUser.exp,
    extra: {
      sub: devUser.sub,
      role: devUser.role,
      iat: devUser.iat,
    },
  } satisfies AuthInfo;

  next();
};
