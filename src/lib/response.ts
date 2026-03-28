import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createTextResult } from "./utils.js";

/**
 * Metadata included in every tool response for LLM context.
 */
export interface ToolMeta {
  filtersApplied: Record<string, unknown>;
  pagination?: {
    total: number;
    limit: number;
    hasMore: boolean;
  };
  metricDefinitions?: Record<string, string>;
  warnings?: string[];
}

/**
 * Options for building a standardized tool response.
 */
export interface ToolResponseOptions {
  tool: string;
  data: unknown;
  meta: ToolMeta;
  count?: number;
  message?: string;
}

/**
 * Builds a standardized tool response with meta object.
 *
 * Determines count from data (array length or 1 for objects),
 * attaches meta for LLM context (filters, pagination, warnings, metric definitions).
 */
export function createToolResponse(options: ToolResponseOptions): CallToolResult {
  const { tool, data, meta, count: explicitCount, message } = options;
  const count = explicitCount ?? (data == null ? 0 : Array.isArray(data) ? data.length : 1);

  const response: Record<string, unknown> = {
    tool,
    count,
    data,
    meta,
  };

  if (message !== undefined) {
    response.message = message;
  }

  return createTextResult(response);
}

/**
 * Builds a standardized error response.
 *
 * Produces consistent error format: { error: true, tool, message, suggestion? }
 */
export function createErrorResponse(
  tool: string,
  message: string,
  suggestion?: string,
): CallToolResult {
  const response: Record<string, unknown> = {
    error: true,
    tool,
    message,
  };

  if (suggestion !== undefined) {
    response.suggestion = suggestion;
  }

  return createTextResult(response);
}
