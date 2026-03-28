# Template Variables

This repo uses `{{VAR}}` placeholders that must be replaced when creating a new project.

## Variables

| Variable | Example | Description | Used in |
|----------|---------|-------------|---------|
| `{{PROJECT_NAME}}` | `cashflow-buddy` | Project identifier (kebab-case) | -- |
| `{{SERVER_SLUG}}` | `cashflow-buddy-mcp-server` | Server/repo name (kebab-case) | package.json, config.ts, vite.config.ts |
| `{{DISPLAY_NAME}}` | `Cashflow Buddy` | Human-readable project name | server.ts, TOOLS_OVERVIEW.md, Dockerfile, README |
| `{{SUPABASE_SCHEMA}}` | `cashflow_buddy` | Supabase database schema name | data-access/client.ts, data-access/types.ts |
| `{{MCP_RESOURCE_ID}}` | `https://mcp.cashflowbuddy.nl` | RFC 9728 resource identifier | auth/config.ts |
| `{{DEV_PORT}}` | `3000` | Local development port | .env.example |
| `{{GITHUB_OWNER}}` | `RobertvandeCamp` | GitHub repo owner | -- |
| `{{ECR_REPO_NAME}}` | `cashflow-buddy/cashflow-buddy-mcp-server` | ECR repository path | .github/workflows/build-test-deploy.yml |

## Replacement Command

Replace all variables at once:

```bash
find . -type f \( -name "*.ts" -o -name "*.json" -o -name "*.md" -o -name "*.yml" -o -name "*.js" \) \
  -not -path './node_modules/*' -not -path './dist/*' \
  -exec sed -i '' \
    -e "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" \
    -e "s/{{SERVER_SLUG}}/$SERVER_SLUG/g" \
    -e "s/{{DISPLAY_NAME}}/$DISPLAY_NAME/g" \
    -e "s/{{SUPABASE_SCHEMA}}/$SUPABASE_SCHEMA/g" \
    -e "s|{{MCP_RESOURCE_ID}}|$MCP_RESOURCE_ID|g" \
    -e "s/{{DEV_PORT}}/$DEV_PORT/g" \
    -e "s/{{GITHUB_OWNER}}/$GITHUB_OWNER/g" \
    -e "s|{{ECR_REPO_NAME}}|$ECR_REPO_NAME|g" \
    {} +
```

Note: `MCP_RESOURCE_ID` and `ECR_REPO_NAME` use `|` as sed delimiter because values contain `/`.
