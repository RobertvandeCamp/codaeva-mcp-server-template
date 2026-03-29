/**
 * Auth module barrel export.
 *
 * Provides JWT validation middleware, JWKS caching, and Protected Resource
 * Metadata for MCP OAuth integration with Supabase.
 */

// Config
export {
  getSupabaseJwksUrl,
  getSupabaseIssuer,
  MCP_RESOURCE_IDENTIFIER,
  PROTECTED_RESOURCE_METADATA_PATH,
} from './config.js';

// Errors
export {
  AuthError,
  buildWWWAuthenticateHeader,
  buildWWWAuthenticateHeaderForMissingToken,
} from './errors.js';
export type { AuthErrorCode } from './errors.js';

// JWKS
export { getJWKS, resetJWKS } from './jwks.js';

// Middleware
export { jwtAuthMiddleware } from './middleware.js';
export type { JwtAuthInfo } from './middleware.js';

// Dev mode
export { isAuthDisabled, devModeAuthMiddleware } from './dev-mode.js';

// Auto-login
export { isAutoLoginEnabled, authenticateAtStartup, autoLoginAuthMiddleware, getAutoLoginToken } from './auto-login.js';

// Protected Resource Metadata (RFC 9728)
export { protectedResourceMetadataHandler } from './protected-resource.js';
export type { ProtectedResourceMetadata } from './protected-resource.js';
