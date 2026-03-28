# Tools Overview - {{DISPLAY_NAME}} MCP Server

## get_my_info

**Purpose:** Returns the authenticated user's profile (email, name, role, admin status).

### WHEN TO USE
- User asks "who am I?", "what's my role?"
- At conversation start for context
- To verify permissions

### Input
No parameters required.

### Output
| Field | Type | Description |
|-------|------|-------------|
| email | string | User's email address |
| full_name | string | User's full name |
| role | string | User's role (e.g. admin, viewer) |
| is_admin | boolean | Whether user has admin privileges |

---

## Adding Tools

See `docs/ADDING_TOOLS.md` for a step-by-step guide to adding new tools.

---

## Tool Annotations

All tools have MCP annotations:
- **readOnlyHint: true** -- Read-only server
- **destructiveHint: false** -- No data modified
- **idempotentHint: true** -- Same input, same output
- **openWorldHint: false** -- No external side-effects

---

**Version:** 1.0.0
