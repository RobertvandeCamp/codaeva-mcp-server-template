# Adding a New Tool

Step-by-step guide for adding a new MCP tool to this server. Uses `get_my_info` as the concrete reference example throughout.

## Step 1: Create the Data Access Query (if needed)

If your tool needs database access, use the per-request Supabase client provided by `createToolHandler`. The client is already scoped to the authenticated user's RLS context.

Example from `get_my_info` -- querying `user_profiles`:

```typescript
const { data, error } = await client
  .from("user_profiles")
  .select("email, full_name, role, is_admin")
  .eq("id", userId)
  .single();
```

For complex queries, create a dedicated function in `src/data-access/` and call it from your handler. For simple queries (like above), inline is fine.

**Skip this step** if your tool doesn't need database access (e.g., a utility or calculation tool).

## Step 2: Create the Tool File

Create `src/tools/your-tool-name.ts`. Export two things: a **tool definition object** and a **handler function**.

### Tool Definition Object

Defines the tool's identity, description, input schema, and behavioral annotations.

```typescript
export const getMyInfoTool = {
  name: "get_my_info",
  title: "Get My Info",
  description: `Returns the authenticated user's profile information including name, email, role, and admin status.

WHEN TO USE:
- User asks "who am I?", "what's my role?", "am I an admin?"
- At the start of a conversation to establish user context
- To check permissions before suggesting actions

Returns: email, full_name, role (e.g. admin/viewer), is_admin boolean.`,
  inputSchema: {},
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};
```

**Key points:**

- **description** must include a `WHEN TO USE` section with trigger phrases. This is how the LLM decides which tool to call. Be specific about user intents.
- **inputSchema** uses JSON Schema format (not Zod). Empty `{}` means no input required.
- **annotations** signal tool behavior to the LLM: `readOnlyHint` (no side effects), `destructiveHint` (deletes data), `idempotentHint` (safe to retry), `openWorldHint` (calls external systems).

### Handler Function

Use the `createToolHandler` wrapper. It handles auth, logging, error catching, and provides a `ToolHandlerContext`.

```typescript
import { createToolHandler } from "../lib/handler.js";
import { createToolResponse } from "../lib/response.js";

interface GetMyInfoInput {}

export const handleGetMyInfo = createToolHandler<GetMyInfoInput>(
  "get_my_info",
  async (_args, { log, client, userId, startTime }) => {
    const { data, error } = await client
      .from("user_profiles")
      .select("email, full_name, role, is_admin")
      .eq("id", userId)
      .single();

    if (error) {
      log.error({ event: "tool.error", error: error.message }, "Failed to fetch user profile");
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    if (!data) {
      throw new Error("User profile not found. Ensure user_profiles table is populated.");
    }

    log.info({ event: "tool.complete", durationMs: Date.now() - startTime }, "Tool complete");

    return createToolResponse({
      tool: "get_my_info",
      data: {
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        is_admin: data.is_admin,
      },
      meta: {
        filtersApplied: {},
      },
    });
  },
);
```

**Pattern:** `createToolHandler<InputType>("tool_name", async (args, ctx) => { ... })`. The generic type parameter types your `args`. The context provides `{ log, requestId, client, userId, startTime }`.

**Error handling:** Throw errors for failures -- the wrapper catches them, logs structured error events, and returns a consistent error response. No try/catch needed in your handler.

**Response:** Always return via `createToolResponse` with `tool`, `data`, and `meta`. See [MCP_TOOLING_PATTERNS.md](./MCP_TOOLING_PATTERNS.md) for meta object details.

## Step 3: Register the Tool in server.ts

Import both exports and register the tool in `src/server.ts`:

```typescript
import { getMyInfoTool, handleGetMyInfo } from "./tools/get-my-info.js";

// Inside getServer():
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
```

After adding your tool, update the `toolCount` in the log statement to match the new total.

## Step 4: Test the Tool

1. Start the server: `npm run dev`
2. Test via MCP Inspector or a configured client
3. Verify:
   - Tool appears in the tool list
   - Returns the expected response shape (data + meta)
   - Error handling works (test with invalid input or missing auth)
   - Structured logging shows `tool.invoked` and `tool.complete` events

## Checklist

- [ ] Data access query created (if needed)
- [ ] Tool file created in `src/tools/` with definition + handler exports
- [ ] Tool description includes `WHEN TO USE` triggers
- [ ] Input schema defined with JSON Schema
- [ ] Annotations set (`readOnlyHint`, `destructiveHint`, etc.)
- [ ] Handler uses `createToolHandler` wrapper
- [ ] Response uses `createToolResponse` with `meta`
- [ ] Tool registered in `server.ts`
- [ ] `toolCount` updated in log statement
- [ ] Tested locally (tool list, response shape, error handling)
