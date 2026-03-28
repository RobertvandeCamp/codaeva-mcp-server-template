# MCP Tooling Patterns

Patterns used in this template for building robust, LLM-optimized MCP tools. Each pattern solves a specific problem. Copy and adapt.

## createToolHandler Wrapper

**Problem:** Every tool needs auth checks, logging, error handling, and a per-request database client. Duplicating this is error-prone.

**Solution:** `createToolHandler` in `src/lib/handler.ts` wraps every tool handler with standard boilerplate. Your handler only contains business logic.

**What the wrapper provides:**

1. Creates a request logger with `requestId`, tool name, `userId`, `sessionId`
2. Records `startTime` for duration tracking
3. Logs `tool.invoked` event with arguments
4. Extracts and validates the access token from `authInfo`
5. Creates a per-request Supabase client (RLS-scoped to the user)
6. Catches errors with structured `tool.error` logging and consistent error response

**The ToolHandlerContext interface:**

```typescript
interface ToolHandlerContext {
  log: Logger;        // Pino child logger scoped to this request
  requestId: string;  // Unique request ID for tracing
  client: AppClient;  // Per-request Supabase client (user's RLS context)
  userId: string;     // Authenticated user ID from JWT
  startTime: number;  // Date.now() at invocation start
}
```

**Usage pattern:**

```typescript
import { createToolHandler } from "../lib/handler.js";

export const handleMyTool = createToolHandler<MyToolInput>(
  "my_tool",
  async (args, { log, client, userId, startTime }) => {
    // Only business logic here. Auth, logging, errors handled by wrapper.
    const { data, error } = await client.from("user_profiles").select("*").eq("id", userId).single();
    if (error) throw new Error(`Query failed: ${error.message}`);

    log.info({ event: "tool.complete", durationMs: Date.now() - startTime }, "Done");
    return createToolResponse({ tool: "my_tool", data, meta: { filtersApplied: {} } });
  },
);
```

**Key insight:** Handler functions never deal with auth tokens, error formatting, or request logging. The wrapper guarantees consistent behavior across all tools.

## Dual Response Format

**Problem:** LLMs need human-readable text for reasoning. Applications need structured JSON for programmatic use. Returning only one format limits consumers.

**Solution:** `createTextResult` in `src/lib/utils.ts` returns both `content` (text) and `structuredContent` (JSON) in every response.

```typescript
// The CallToolResult returned by createTextResult:
{
  content: [{ type: "text", text: "get my info: Found 1 result.\n\n..." }],
  structuredContent: { tool: "get_my_info", count: 1, data: { ... }, meta: { ... } }
}
```

- **content**: Auto-generated human-readable summary. Includes item counts, filter info, pagination notices, warnings, and a full JSON block. LLMs read this for reasoning.
- **structuredContent**: The raw response object. Applications parse this directly.

You never call `createTextResult` directly -- it is called internally by `createToolResponse`. Just pass your data and meta to `createToolResponse`, and both formats are produced automatically.

## Meta Object

**Problem:** LLMs receiving tool results need context: what filters were active? Is there more data? What do the numbers mean? Without this, LLMs make incorrect assumptions.

**Solution:** The `ToolMeta` interface in `src/lib/response.ts` provides structured metadata alongside every response.

```typescript
interface ToolMeta {
  filtersApplied: Record<string, unknown>;   // Active filters (e.g., { status: "active", year: 2026 })
  pagination?: {
    total: number;    // Total matching records
    limit: number;    // Records returned in this response
    hasMore: boolean; // Whether more records exist beyond the limit
  };
  metricDefinitions?: Record<string, string>; // Explain what metrics mean
  warnings?: string[];                        // Truncation notices, data quality notes
}
```

**Usage in a tool handler:**

```typescript
return createToolResponse({
  tool: "list_items",
  data: items,
  meta: {
    filtersApplied: { status: args.status ?? null, year: args.year ?? 2026 },
    pagination: { total: totalCount, limit: 50, hasMore: totalCount > 50 },
    metricDefinitions: { fill_rate: "Percentage of ordered quantity actually delivered" },
    warnings: items.length === 50 ? ["Results truncated at 50. Use pagination for more."] : [],
  },
});
```

**Why each field matters:**

- `filtersApplied` -- LLM knows what subset of data it received, can suggest narrowing or broadening filters
- `pagination` -- LLM knows if results are complete or truncated, can request next page
- `metricDefinitions` -- LLM interprets domain-specific numbers correctly without guessing
- `warnings` -- LLM communicates data limitations to the user proactively

## MCP Prompts

**Problem:** Users don't always know the best way to use available tools. LLMs benefit from pre-built conversation starters that demonstrate effective tool usage patterns.

**Solution:** Register MCP prompts that provide structured conversation templates. Prompts appear in the client's prompt library and guide LLMs toward effective analysis patterns.

**Registration pattern:**

```typescript
server.registerPrompt(
  "weekly-analysis",
  {
    description: "Analyze this week's data with KPI summary and trends",
    arguments: [
      { name: "week", description: "Week number to analyze", required: true },
      { name: "year", description: "Year (defaults to current)", required: false },
    ],
  },
  async ({ week, year }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Analyze week ${week} of ${year ?? new Date().getFullYear()}:
1. Start with get_weekly_report for KPI overview
2. Identify the top 3 items by volume
3. Compare with the previous week for trends
4. Flag any anomalies or significant changes`,
        },
      },
    ],
  }),
);
```

**When to use prompts:**

- Recurring analysis workflows (weekly reviews, comparisons)
- Multi-step tool chains that benefit from guided sequencing
- Domain-specific analysis templates that encode expert knowledge

Prompts complement tool descriptions. Tool descriptions say *what* a tool does; prompts say *how to combine tools effectively*.
