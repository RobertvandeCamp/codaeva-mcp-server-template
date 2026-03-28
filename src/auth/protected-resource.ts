/**
 * Protected Resource Metadata endpoint per RFC 9728.
 *
 * Provides OAuth 2.0 authorization server discovery for MCP clients.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/
 */

import type { RequestHandler } from 'express';
import { MCP_RESOURCE_IDENTIFIER, SUPABASE_ISSUER } from './config.ts';

/**
 * Protected Resource Metadata per RFC 9728 Section 3.
 */
export interface ProtectedResourceMetadata {
  /** Resource identifier (REQUIRED) */
  resource: string;
  /** Authorization servers that can issue tokens for this resource (REQUIRED) */
  authorization_servers: string[];
  /** Methods for sending Bearer token (OPTIONAL) */
  bearer_methods_supported?: string[];
  /** Documentation URL for this resource (OPTIONAL) */
  resource_documentation?: string;
}

/**
 * Protected Resource Metadata endpoint handler.
 *
 * Serves JSON metadata at /.well-known/oauth-protected-resource
 * telling MCP clients which authorization server to use.
 *
 * Response includes:
 * - resource: This server's resource identifier
 * - authorization_servers: Supabase OAuth endpoint
 * - bearer_methods_supported: ['header'] (Authorization header only)
 *
 * Caches for 1 hour (static metadata).
 */
export const protectedResourceMetadataHandler: RequestHandler = (_req, res) => {
  const metadata: ProtectedResourceMetadata = {
    resource: MCP_RESOURCE_IDENTIFIER,
    authorization_servers: [SUPABASE_ISSUER],
    bearer_methods_supported: ['header'],
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'max-age=3600'); // 1 hour cache
  res.json(metadata);
};
