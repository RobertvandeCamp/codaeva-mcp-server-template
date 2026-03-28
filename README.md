# {{DISPLAY_NAME}} MCP Server

MCP server for {{DISPLAY_NAME}} with Supabase authentication and Express transport.

## Quick Start

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in Supabase credentials in `.env`:
   - `SUPABASE_URL` -- Your Supabase project URL
   - `SUPABASE_ANON_KEY` -- Supabase anon/public key

3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

4. Health check:
   ```
   GET http://localhost:{{DEV_PORT}}/health
   ```

## Auth Modes

| Mode | Environment | Config |
|------|-------------|--------|
| JWT/JWKS | Production | Default -- validates tokens via Supabase JWKS |
| Dev mode | Development | `AUTH_DISABLED=true` -- bypasses auth, requires `SUPABASE_SERVICE_KEY` |
| Auto-login | Development | `AUTH_EMAIL` + `AUTH_PASSWORD` -- authenticates at startup |

## Tools

| Tool | Description |
|------|-------------|
| `get_my_info` | Returns authenticated user's profile (email, name, role, admin status) |

## Project Structure

```
src/
├── index.ts          # Entry point
├── server.ts         # Express + MCP transport
├── config.ts         # Zod env validation
├── logger.ts         # Pino + AsyncLocalStorage
├── auth/             # JWT, dev mode, auto-login (8 files)
├── lib/              # createToolHandler, response utils
├── tools/            # MCP tools (get-my-info.ts)
├── data-access/      # Supabase client, queries, types
└── resources/        # MCP resources (TOOLS_OVERVIEW.md)
```

## Docker

Build for production (amd64):
```bash
docker buildx build --platform linux/amd64 -f docker/Dockerfile -t your-ecr-repo:latest --push .
```

## Template Variables

See [TEMPLATE_VARS.md](TEMPLATE_VARS.md) for all `{{VAR}}` placeholders.
