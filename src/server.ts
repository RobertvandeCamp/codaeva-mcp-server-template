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
  server.registerTool(
    getMyInfoTool.name,
    {
      title: getMyInfoTool.title,
      description: getMyInfoTool.description,
      inputSchema: getMyInfoTool.inputSchema,
      annotations: getMyInfoTool.annotations,
    },
    handleGetMyInfo,
  );

  logger.info(
    { toolCount: 1, resourceCount: resources.length },
    "Tools and resources registered",
  );

  return server;
};

export const createApp = () => {
  const app = express();

  // CORS configuration for browser-based clients (MCP Inspector, web apps)
  app.use(cors({
    origin: true, // Allow all origins (or specify allowed origins)
    methods: ['GET', 'POST', 'OPTIONS'],
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

  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  const mcpHandler = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const activeSessionCount = Object.keys(transports).length;

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
      // Handle initialization requests (usually POST without session ID)
      if (req.method === "POST" && !sessionId && isInitializeRequest(req.body)) {
        logger.info({ event: "session.initializing" }, "Initializing new MCP session");

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            transports[sessionId] = transport;
            logger.info({ sessionId, event: "session.created" }, "MCP session created");
          },
        });

        // Register close handler for session cleanup
        transport.onclose = () => {
          const closedSessionId = Object.entries(transports).find(([, t]) => t === transport)?.[0];
          if (closedSessionId) {
            delete transports[closedSessionId];
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
      if (sessionId && transports[sessionId]) {
        logger.info(
          { sessionId, event: "session.request", method: req.body?.method },
          "MCP session request",
        );
        const transport = transports[sessionId];
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
      if (sessionId && !transports[sessionId]) {
        logger.warn(
          {
            sessionId,
            activeSessionCount,
            activeSessions: Object.keys(transports),
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

  return app;
};
