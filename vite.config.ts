import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(({ command }) => ({
  // Build configuration
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "{{SERVER_SLUG}}",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        "@modelcontextprotocol/sdk",
        "@modelcontextprotocol/sdk/server/mcp.js",
        "@modelcontextprotocol/sdk/server/streamableHttp.js",
        "@modelcontextprotocol/sdk/server/auth/types.js",
        "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js",
        "@modelcontextprotocol/sdk/shared/protocol.js",
        "@modelcontextprotocol/sdk/types.js",
        "@supabase/supabase-js",
        "express",
        "cors",
        "jose",
        "zod",
        "pino",
        "pino-pretty",
        "dotenv",
        "node:async_hooks",
        "node:crypto",
        "node:http",
        "node:path",
        "node:fs",
        "node:url",
        "node:buffer",
        "node:stream",
        "node:events",
        "node:util",
        "async_hooks",
        "crypto",
        "http",
        "path",
        "fs",
        "url",
        "buffer",
        "stream",
        "events",
        "util",
      ],
      output: {
        format: "es",
      },
    },
    target: "node22",
    outDir: "dist",
    emptyOutDir: true,
    ssr: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  ssr: {
    external: ["@modelcontextprotocol/sdk", "@supabase/supabase-js", "express", "cors", "jose", "zod", "pino", "pino-pretty", "dotenv"],
  },
}));
