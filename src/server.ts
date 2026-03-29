import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { logger, requestContext } from "./logger.js";
import { getConfig } from "./config.js";
import {
  getDocumentationResources,
  getResourceByUri,
} from "./resources/loader.js";
import { getMyInfoTool, handleGetMyInfo } from "./tools/get-my-info.js";
import {
  protectedResourceMetadataHandler,
  PROTECTED_RESOURCE_METADATA_PATH,
  jwtAuthMiddleware,
  isAuthDisabled,
  devModeAuthMiddleware,
  isAutoLoginEnabled,
  autoLoginAuthMiddleware,
} from "./auth/index.js";

export const getServer = () => {
  const config = getConfig();
  const server = new McpServer({
    name: config.SERVER_NAME,
    version: config.SERVER_VERSION,
  });

  // Register resources
  const resources = getDocumentationResources();
  resources.forEach((resource) => {
    server.registerResource(
      resource.name.toLowerCase().replace(/\s+/g, "-"),
      resource.uri,
      {
        title: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async () => {
        const loadedResource = getResourceByUri(resource.uri);
        if (!loadedResource) {
          throw new Error(`Resource not found: ${resource.uri}`);
        }
        return {
          contents: [
            {
              uri: loadedResource.uri,
              mimeType: loadedResource.mimeType,
              text: loadedResource.content,
            },
          ],
        };
      },
    );
  });

  // Register tools
  const tools = [
    { def: getMyInfoTool, handler: handleGetMyInfo },
  ];

  for (const { def, handler } of tools) {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      handler,
    );
  }

  logger.info(
    { toolCount: tools.length, resourceCount: resources.length },
    "Tools and resources registered",
  );

  return server;
};

export const createApp = () => {
  const app = express();

  // CORS: Allow all origins. This is intentional for MCP servers -- clients like
  // MCP Inspector, Claude Desktop, and custom web apps connect from various origins.
  app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'mcp-session-id'],
    exposedHeaders: ['mcp-session-id'],
    credentials: true,
  }));

  app.use(express.json());

  // Determine auth middleware based on environment
  const authMiddleware = isAutoLoginEnabled()
    ? autoLoginAuthMiddleware
    : isAuthDisabled()
      ? devModeAuthMiddleware
      : jwtAuthMiddleware;

  // Log auth mode on startup for debugging
  const authMode = isAutoLoginEnabled()
    ? 'auto-login'
    : isAuthDisabled()
      ? 'DISABLED (dev mode)'
      : 'ENABLED';
  logger.info({ authMode }, 'Auth middleware configured');

  const transports = new Map<string, StreamableHTTPServerTransport>();

  const mcpHandler = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const activeSessionCount = transports.size;

    logger.info(
      {
        event: "session.request",
        method: req.method,
        sessionId: sessionId ?? "none",
        activeSessionCount,
        mcpMethod: req.body?.method ?? null,
      },
      "MCP request received",
    );

    try {
      // Guard: batch (array) requests are not yet supported
      if (Array.isArray(req.body)) {
        res.status(400).json({ error: "Batch requests are not supported" });
        return;
      }

      // Handle initialization requests (usually POST without session ID)
      if (req.method === "POST" && !sessionId && isInitializeRequest(req.body)) {
        logger.info({ event: "session.initializing" }, "Initializing new MCP session");

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports.set(newSessionId, transport);
            logger.info({ sessionId: newSessionId, event: "session.created" }, "MCP session created");
          },
        });

        // Register close handler for session cleanup (S8)
        transport.onclose = () => {
          const closedSessionId = [...transports.entries()].find(([, t]) => t === transport)?.[0];
          if (closedSessionId) {
            transports.delete(closedSessionId);
            logger.info({ sessionId: closedSessionId, event: "session.destroyed" }, "MCP session destroyed");
          }
        };

        const server = getServer();
        await server.connect(transport);
        await requestContext.run({ sessionId: "initializing" }, () =>
          transport.handleRequest(req, res, req.body)
        );
        return;
      }

      // Handle existing session requests
      if (sessionId && transports.has(sessionId)) {
        logger.info(
          { sessionId, event: "session.request", method: req.body?.method },
          "MCP session request",
        );
        const transport = transports.get(sessionId)!;
        await requestContext.run({ sessionId }, () =>
          transport.handleRequest(req, res, req.body)
        );
        return;
      }

      // Handle case where no session ID is provided for non-init requests
      if (req.method === "POST" && !sessionId) {
        logger.warn(
          "POST request without session ID for non-initialization request",
        );
        res
          .status(400)
          .json({ error: "Session ID required for non-initialization requests" });
        return;
      }

      // Handle unknown session
      if (sessionId && !transports.has(sessionId)) {
        logger.warn(
          {
            sessionId,
            activeSessionCount,
          },
          "Request for unknown session - client should re-initialize",
        );
        res.status(404).json({
          error: "Session not found",
          message: "Session expired or server was restarted. Please re-initialize.",
        });
        return;
      }

      // For GET requests without session, return server info
      if (req.method === "GET") {
        const config = getConfig();
        res.json({
          name: config.SERVER_NAME,
          version: config.SERVER_VERSION,
          description: "{{DISPLAY_NAME}} MCP Server",
          capabilities: ["tools"],
        });
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : error },
        "Error handling MCP request",
      );
      res.status(500).json({ error: "Internal server error" });
    }
  };

  // Health check endpoint
  app.get("/health", (_req, res) => {
    const config = getConfig();
    res.json({
      status: "ok",
      server: config.SERVER_NAME,
      version: config.SERVER_VERSION,
    });
  });

  // OAuth Protected Resource Metadata (RFC 9728)
  app.get(PROTECTED_RESOURCE_METADATA_PATH, protectedResourceMetadataHandler);

  // Protected MCP endpoints - auth required on ALL routes
  app.post("/mcp", authMiddleware, mcpHandler);
  app.get("/mcp", authMiddleware, mcpHandler);

  // DELETE /mcp -- session termination (S5)
  app.delete("/mcp", authMiddleware, (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string;
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      transport.close();
      transports.delete(sessionId);
      res.status(200).json({ message: "Session terminated" });
    } else {
      res.status(404).json({ error: "Session not found" });
    }
  });

  return app;
};
