/**
 * Auth error types and WWW-Authenticate header builders per RFC 6750 + MCP spec.
 */

/**
 * OAuth error codes per RFC 6750 Section 3.1
 */
export type AuthErrorCode =
  | 'invalid_token'
  | 'missing_token'
  | 'expired_token'
  | 'invalid_issuer';

/**
 * Authentication error with RFC 6750 error code.
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Build WWW-Authenticate header per RFC 6750 + MCP spec.
 *
 * Format: Bearer error="code", error_description="message", resource_metadata="url"
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6750#section-3
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/
 */
export function buildWWWAuthenticateHeader(
  error: AuthError,
  resourceMetadataUrl: string
): string {
  return `Bearer error="${error.code}", error_description="${error.message}", resource_metadata="${resourceMetadataUrl}"`;
}

/**
 * Build WWW-Authenticate header for missing token case.
 *
 * Per RFC 6750, when no token is present, only the resource_metadata is included
 * (no error code).
 *
 * Format: Bearer resource_metadata="url"
 */
export function buildWWWAuthenticateHeaderForMissingToken(
  resourceMetadataUrl: string
): string {
  return `Bearer resource_metadata="${resourceMetadataUrl}"`;
}
