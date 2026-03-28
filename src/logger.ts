import pino from "pino";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { getConfig } from "./config.js";

const config = getConfig();

export const logger = pino({
  level: config.LOG_LEVEL,
  // Always JSON output. Pretty print via CLI: node dist/index.js | pino-pretty
  base: {
    service: config.SERVER_NAME,
    version: config.SERVER_VERSION,
    env: config.NODE_ENV,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * AsyncLocalStorage for propagating sessionId from Express request to tool handlers.
 */
export const requestContext = new AsyncLocalStorage<{ sessionId: string }>();

/**
 * Creates a child logger bound to a specific request context.
 * All log entries from this logger include requestId, tool, userId, sessionId.
 */
export function createRequestLogger(context: {
  tool: string;
  userId?: string;
  sessionId?: string;
}) {
  const requestId = randomUUID();
  const ctxSession = context.sessionId ?? requestContext.getStore()?.sessionId ?? "unknown";
  return {
    log: logger.child({
      requestId,
      tool: context.tool,
      userId: context.userId ?? "unknown",
      sessionId: ctxSession,
    }),
    requestId,
  };
}
