# Multi-stage Dockerfile for {{DISPLAY_NAME}} MCP Server
# Target platform: linux/amd64 (AWS AppRunner requirement)
#
# IMPORTANT: On ARM Macs, `docker build` silently produces arm64 images even with
# --platform=linux/amd64 in the FROM line. This causes App Runner health check
# failures with no application logs. Always use buildx:
#
#   docker buildx build --platform linux/amd64 -f docker/Dockerfile \
#     -t {{ECR_REPO_NAME}}:latest \
#     --push .

# =============================================================================
# BUILDER STAGE - Compile TypeScript and install all dependencies
# =============================================================================
FROM --platform=linux/amd64 node:24-slim AS builder

# Build tools for native modules (if needed)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Source code and build
# Note: npm run build includes copy-resources which copies src/resources/*.md to dist/resources/
COPY ./src/ ./src/
COPY tsconfig.json vite.config.ts ./
RUN npm run build

# =============================================================================
# RUNNER STAGE - Minimal production image
# =============================================================================
FROM --platform=linux/amd64 node:24-slim AS runner

WORKDIR /app

# Only production artifacts
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/dist ./dist

# Production dependencies only
RUN npm ci --omit=dev --prefer-offline && npm cache clean --force

# Non-root user for security
USER node

# Default port (can be overridden via PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

CMD ["npm", "start"]
