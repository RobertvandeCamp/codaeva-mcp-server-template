import { createApp } from "./server.js";
import { getConfig } from "./config.js";
import { logger } from "./logger.js";
import { isAutoLoginEnabled, authenticateAtStartup } from "./auth/index.js";

async function main() {
  const config = getConfig();
  const app = createApp();

  // Auto-login: authenticate before starting the server
  if (isAutoLoginEnabled()) {
    const email = process.env.AUTH_EMAIL!;
    const password = process.env.AUTH_PASSWORD!;
    await authenticateAtStartup(email, password);
  }

  // Graceful shutdown handling
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down gracefully");
    process.exit(0);
  });

  app.listen(config.PORT, () => {
    logger.info(
      {
        environment: config.NODE_ENV,
        serverName: config.SERVER_NAME,
        version: config.SERVER_VERSION,
      },
      `${config.SERVER_NAME} running on port ${config.PORT}`,
    );
  });
}

main().catch((error) => {
  logger.error(
    { error: error instanceof Error ? error.message : error },
    "Server startup error",
  );
  process.exit(1);
});
