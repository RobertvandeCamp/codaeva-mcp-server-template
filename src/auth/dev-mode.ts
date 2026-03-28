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
import type { JwtAuthInfo } from './middleware.ts';

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
 * Development user for local testing.
 *
 * This user is only used when auth is disabled in non-production environments.
 */
export const DEV_USER: JwtAuthInfo = {
  sub: 'dev-user-local',
  role: 'authenticated',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
};

/**
 * Dev mode authentication middleware.
 *
 * Sets both req.jwtAuth (for backward compatibility) and req.auth (for MCP SDK
 * context propagation) with development user credentials.
 *
 * Should only be used when isAuthDisabled() returns true.
 */
export const devModeAuthMiddleware: RequestHandler = (req, _res, next) => {
  // Set JWT auth info (backward compatibility)
  req.jwtAuth = DEV_USER;

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
    clientId: DEV_USER.sub,
    scopes: DEV_USER.role ? [DEV_USER.role] : [],
    expiresAt: DEV_USER.exp,
    extra: {
      sub: DEV_USER.sub,
      role: DEV_USER.role,
      iat: DEV_USER.iat,
    },
  } satisfies AuthInfo;

  next();
};
