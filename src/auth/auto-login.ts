/**
 * Auto-login authentication for MCP server instances.
 *
 * When AUTH_EMAIL + AUTH_PASSWORD environment variables are set (non-production only),
 * the server authenticates with Supabase at startup and injects the session token
 * into every request. This enables MCP server instances for ops folders to
 * authenticate automatically without requiring an OAuth flow.
 *
 * SECURITY: Auto-login is explicitly blocked in production environments.
 */

import type { RequestHandler } from 'express';
// Side-effect import to activate MCP SDK's Request.auth type extension
import '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { mapToMcpAuthInfo } from './middleware.js';
import type { JwtAuthInfo } from './middleware.js';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { decodeJwt } from 'jose';
import { logger } from '../logger.js';

/**
 * Module-level session storage.
 * Updated by onAuthStateChange listener on TOKEN_REFRESHED and SIGNED_IN events.
 */
let currentSession: Session | null = null;

/**
 * Check if auto-login mode is enabled.
 *
 * Returns true only if:
 * - AUTH_EMAIL AND AUTH_PASSWORD are both set, AND
 * - NODE_ENV is NOT 'production'
 *
 * Throws if:
 * - AUTH_EMAIL is set in production (security violation)
 * - Only one of AUTH_EMAIL/AUTH_PASSWORD is set (configuration error)
 */
export function isAutoLoginEnabled(): boolean {
  const authEmail = process.env.AUTH_EMAIL;
  const authPassword = process.env.AUTH_PASSWORD;
  const isProduction = process.env.NODE_ENV === 'production';

  // Neither set: not enabled
  if (!authEmail && !authPassword) {
    return false;
  }

  // Production guard
  if ((authEmail || authPassword) && isProduction) {
    throw new Error(
      'SECURITY: Auto-login is not allowed in production. Remove AUTH_EMAIL and AUTH_PASSWORD environment variables.',
    );
  }

  // Both must be set
  if (!authEmail || !authPassword) {
    throw new Error(
      'Both AUTH_EMAIL and AUTH_PASSWORD must be set for auto-login mode.',
    );
  }

  return true;
}

/**
 * Authenticate with Supabase at server startup.
 *
 * Signs in with email/password, stores the session, and sets up
 * an onAuthStateChange listener for automatic token refresh.
 *
 * @throws Error if authentication fails (server should not start)
 */
export async function authenticateAtStartup(email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Auto-login requires SUPABASE_URL and SUPABASE_ANON_KEY environment variables.',
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
  });

  // Sign in
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(`Auto-login failed: ${error.message} (${email})`);
  }

  currentSession = data.session;
  logger.info({ email }, 'Auto-login successful');

  // Listen for token refresh events
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      currentSession = session;
      if (event === 'TOKEN_REFRESHED') {
        logger.info('Auto-login token refreshed');
      }
    }
  });
}

/**
 * Get the current auto-login access token.
 *
 * @returns The current Supabase access token, or null if not authenticated.
 */
export function getAutoLoginToken(): string | null {
  return currentSession?.access_token ?? null;
}

/**
 * Auto-login authentication middleware for Express.
 *
 * Injects the auto-login session token into every request, setting both
 * req.jwtAuth (backward compatibility) and req.auth (MCP SDK AuthInfo).
 *
 * Returns 503 if the auto-login session is not yet established.
 */
export const autoLoginAuthMiddleware: RequestHandler = (req, res, next) => {
  const token = getAutoLoginToken();

  if (!token) {
    res.status(503).json({
      error: 'auto_login_not_ready',
      error_description: 'Auto-login session not established yet',
    });
    return;
  }

  // Decode JWT (no verification needed -- we trust Supabase's own token)
  const payload = decodeJwt(token);

  const sub = payload.sub as string;
  const role = payload.role as string | undefined;
  const iat = payload.iat;
  const exp = payload.exp;

  // Set JWT auth info (backward compatibility)
  const jwtAuth: JwtAuthInfo = { sub, role, iat, exp };
  req.jwtAuth = jwtAuth;

  // Set MCP SDK AuthInfo for context propagation to tools
  req.auth = mapToMcpAuthInfo(jwtAuth, token);

  next();
};
