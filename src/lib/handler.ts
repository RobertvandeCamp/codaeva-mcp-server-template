import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "pino";
import { createRequestLogger } from "../logger.js";
import { createErrorResponse } from "./response.js";
import { createUserClient } from "../data-access/client.js";
import type { AppClient } from "../data-access/client.js";

export type { AppClient } from "../data-access/client.js";

/**
 * Context provided to every tool handler by the createToolHandler wrapper.
 * Eliminates boilerplate: auth check, client creation, logging, error handling.
 */
export interface ToolHandlerContext {
  log: Logger;
  requestId: string;
  client: AppClient;
  userId: string;
  startTime: number;
}

/**
 * Wraps a tool handler with standard boilerplate:
 * 1. Creates request logger (requestId, tool, userId, sessionId)
 * 2. Records startTime
 * 3. Logs tool.invoked event
 * 4. Extracts and validates access token (auth check)
 * 5. Creates per-request Supabase client
 * 6. Calls the handler with args + context
 * 7. Catches errors with tool.error logging and consistent error response
 */
export function createToolHandler<TArgs>(
  toolName: string,
  handler: (args: TArgs, ctx: ToolHandlerContext) => Promise<CallToolResult>,
): (args: TArgs, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => Promise<CallToolResult> {
  return async (args: TArgs, extra: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> => {
    const { log, requestId } = createRequestLogger({
      tool: toolName,
      userId: extra.authInfo?.clientId,
    });
    const startTime = Date.now();

    try {
      log.info({ event: "tool.invoked", args }, "Tool invoked");

      const accessToken = extra.authInfo?.token;
      if (!accessToken) {
        return createErrorResponse(toolName, "Authentication required");
      }

      const client = createUserClient(accessToken);
      const userId = extra.authInfo?.clientId ?? "unknown";

      return await handler(args, { log, requestId, client, userId, startTime });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);

      log.error(
        { event: "tool.error", durationMs, error: message },
        "Tool error",
      );

      return createErrorResponse(
        toolName,
        message,
        "An unexpected error occurred. Please try again.",
      );
    }
  };
}
