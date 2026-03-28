/**
 * Express JWT authentication middleware.
 *
 * Validates Bearer tokens against Supabase's JWKS endpoint and attaches
 * authenticated user info to the request.
 */

import type { RequestHandler } from 'express';
import { jwtVerify, errors } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
// Side-effect import to activate MCP SDK's Request.auth type extension
import '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { getJWKS } from './jwks.ts';
import {
  SUPABASE_ISSUER,
  MCP_RESOURCE_IDENTIFIER,
  PROTECTED_RESOURCE_METADATA_PATH,
} from './config.ts';
import {
  AuthError,
  buildWWWAuthenticateHeader,
  buildWWWAuthenticateHeaderForMissingToken,
} from './errors.ts';

/**
 * Authenticated user information extracted from JWT.
 *
 * Named JwtAuthInfo to avoid conflict with MCP SDK's AuthInfo type
 * which is already defined on Express.Request.auth
 */
export interface JwtAuthInfo {
  /** User ID (subject claim) */
  sub: string;
  /** Supabase role claim */
  role?: string;
  /** Token issued at timestamp */
  iat?: number;
  /** Token expiration timestamp */
  exp?: number;
}

/**
 * Extend Express Request type to include JWT auth info.
 *
 * Uses 'jwtAuth' instead of 'auth' to avoid conflict with
 * MCP SDK's AuthInfo on Request.auth
 */
declare global {
  namespace Express {
    interface Request {
      jwtAuth?: JwtAuthInfo;
    }
  }
}

/**
 * Build the full resource metadata URL.
 */
function getResourceMetadataUrl(): string {
  return `${MCP_RESOURCE_IDENTIFIER}${PROTECTED_RESOURCE_METADATA_PATH}`;
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Map JWT auth info to MCP SDK's AuthInfo format.
 *
 * This enables context propagation to MCP tools via req.auth while
 * maintaining backward compatibility via req.jwtAuth.
 *
 * The raw access token is included so downstream code (e.g. Supabase client)
 * can execute queries in the user's RLS context.
 */
export function mapToMcpAuthInfo(jwtAuth: JwtAuthInfo, token: string): AuthInfo {
  return {
    token, // Raw access token for per-user Supabase client (RBAC/RLS)
    clientId: jwtAuth.sub,
    scopes: jwtAuth.role ? [jwtAuth.role] : [],
    expiresAt: jwtAuth.exp,
    extra: {
      sub: jwtAuth.sub,
      role: jwtAuth.role,
      iat: jwtAuth.iat,
    },
  };
}

/**
 * Map jose error to AuthError with appropriate code.
 */
function mapJoseError(error: unknown): AuthError {
  if (error instanceof errors.JWTExpired) {
    return new AuthError('expired_token', 'Token has expired');
  }

  if (error instanceof errors.JWTClaimValidationFailed) {
    // Check if it's an issuer validation failure
    if (error.claim === 'iss') {
      return new AuthError('invalid_issuer', 'Token issuer is not trusted');
    }
    return new AuthError('invalid_token', `Invalid claim: ${error.claim}`);
  }

  if (error instanceof errors.JWSSignatureVerificationFailed) {
    return new AuthError('invalid_token', 'Token signature verification failed');
  }

  if (error instanceof errors.JWKSNoMatchingKey) {
    return new AuthError('invalid_token', 'No matching key found in JWKS');
  }

  // Generic invalid token for other jose errors
  if (error instanceof Error) {
    return new AuthError('invalid_token', error.message);
  }

  return new AuthError('invalid_token', 'Token validation failed');
}

/**
 * JWT authentication middleware for Express.
 *
 * Validates Bearer tokens against Supabase's JWKS endpoint.
 * On success, attaches JwtAuthInfo to req.jwtAuth.
 * On failure, returns 401 with WWW-Authenticate header per RFC 6750.
 *
 * Note: Audience validation is not performed because Supabase doesn't set
 * the aud claim by default.
 */
export const jwtAuthMiddleware: RequestHandler = async (req, res, next) => {
  const resourceMetadataUrl = getResourceMetadataUrl();
  const token = extractBearerToken(req.headers.authorization);

  // No token present
  if (!token) {
    res.setHeader(
      'WWW-Authenticate',
      buildWWWAuthenticateHeaderForMissingToken(resourceMetadataUrl)
    );
    res.status(401).json({
      error: 'missing_token',
      error_description: 'No Bearer token provided',
    });
    return;
  }

  try {
    // Validate token against Supabase JWKS
    // Note: No audience validation - Supabase doesn't set aud claim by default
    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: SUPABASE_ISSUER,
      requiredClaims: ['sub'],
    });

    // Attach JWT auth info to request (uses jwtAuth to avoid MCP SDK conflict)
    req.jwtAuth = {
      sub: payload.sub as string,
      role: payload.role as string | undefined,
      iat: payload.iat,
      exp: payload.exp,
    };

    // Map to MCP SDK's AuthInfo for context propagation to tools
    req.auth = mapToMcpAuthInfo(req.jwtAuth, token);

    next();
  } catch (error) {
    const authError = mapJoseError(error);

    res.setHeader(
      'WWW-Authenticate',
      buildWWWAuthenticateHeader(authError, resourceMetadataUrl)
    );
    res.status(authError.statusCode).json({
      error: authError.code,
      error_description: authError.message,
    });
  }
};
