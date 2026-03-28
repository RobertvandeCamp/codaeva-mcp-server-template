/**
 * Auth module barrel export.
 *
 * Provides JWT validation middleware, JWKS caching, and Protected Resource
 * Metadata for MCP OAuth integration with Supabase.
 */

// Config
export {
  SUPABASE_JWKS_URL,
  SUPABASE_ISSUER,
  MCP_RESOURCE_IDENTIFIER,
  PROTECTED_RESOURCE_METADATA_PATH,
} from './config.ts';

// Errors
export {
  AuthError,
  buildWWWAuthenticateHeader,
  buildWWWAuthenticateHeaderForMissingToken,
} from './errors.ts';
export type { AuthErrorCode } from './errors.ts';

// JWKS
export { getJWKS, resetJWKS } from './jwks.ts';

// Middleware
export { jwtAuthMiddleware } from './middleware.ts';
export type { JwtAuthInfo } from './middleware.ts';

// Dev mode
export { isAuthDisabled, devModeAuthMiddleware } from './dev-mode.ts';

// Auto-login
export { isAutoLoginEnabled, authenticateAtStartup, autoLoginAuthMiddleware, getAutoLoginToken } from './auto-login.ts';

// Protected Resource Metadata (RFC 9728)
export { protectedResourceMetadataHandler } from './protected-resource.ts';
export type { ProtectedResourceMetadata } from './protected-resource.ts';
