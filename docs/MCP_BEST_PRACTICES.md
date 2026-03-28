# MCP Best Practices

Production patterns for building robust MCP servers. Each section includes copyable code.

## Response Structure

Every tool returns a dual-format response: human-readable `content` for LLM reasoning and `structuredContent` for programmatic use. Use `createToolResponse` for consistency:

```typescript
return createToolResponse({
  tool: "list_orders",
  data: orders,
  meta: {
    filtersApplied: { status, region },
    pagination: { total: 142, limit: 50, hasMore: true },
    metricDefinitions: {
      fulfillment_rate: "Shipped orders / total orders as percentage",
    },
    warnings: ["Results truncated to 50 items"],
  },
});
```

The `meta` object provides LLM context without polluting the data payload:

- **filtersApplied** -- Echo back which filters were active so the LLM knows the scope.
- **pagination** -- `{ total, limit, hasMore }` tells the LLM whether to request more.
- **metricDefinitions** -- Explain computed fields so the LLM interprets numbers correctly.
- **warnings** -- Signal truncation, stale data, or partial results.

## Error Handling

Use `createErrorResponse` for structured, actionable errors:

```typescript
return createErrorResponse(
  "get_user",
  "User not found for ID abc-123",
  "Verify the user ID exists in user_profiles, or call list_users first."
);
```

Output shape: `{ error: true, tool, message, suggestion }`.

The `suggestion` field is critical -- it tells the LLM what to try next. Without it, errors become dead ends.

**When to throw vs return error:**

- **Throw** inside `createToolHandler` for unexpected failures (DB connection lost, auth token expired). The wrapper catches it, logs `tool.error`, and returns a formatted error response.
- **Return `createErrorResponse`** for expected failures (invalid filter, no results for query). This avoids noisy error logs for normal flow.

## Annotations

MCP tool annotations declare behavioral hints to clients:

```typescript
annotations: {
  readOnlyHint: true,      // Tool only reads data, never modifies
  destructiveHint: false,   // Tool does not delete or overwrite
  idempotentHint: true,     // Same input always produces same output
  openWorldHint: false,     // Tool operates on a closed, known dataset
}
```

Guidelines:
- **readOnlyHint: true** for all query/lookup tools.
- **destructiveHint: true** for delete/archive operations -- clients may require confirmation.
- **idempotentHint: true** for GET-like operations; false for tools that create records.
- **openWorldHint: true** for tools that query external APIs or web search.

## Logging

Use Pino structured logging with base fields and per-request context:

```typescript
// Base logger (set once at startup)
const logger = pino({
  base: { service: "my-mcp-server", version: "1.0.0", env: "production" },
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Per-request logger (created per tool invocation)
const { log, requestId } = createRequestLogger({
  tool: "list_orders",
  userId: authInfo.clientId,
  sessionId: extra.sessionId,
});

log.info({ event: "tool.invoked", args }, "Tool invoked");
// ... handler logic ...
log.info({ event: "tool.complete", durationMs: Date.now() - start }, "Tool complete");
```

Event naming convention:
- `tool.invoked` -- Entry point, log arguments.
- `tool.complete` -- Success, log duration.
- `tool.error` -- Failure, log error message and duration.

Use `AsyncLocalStorage` to propagate `sessionId` from the Express request layer into tool handlers without passing it through every function.

## Testing

Test tools by calling handlers directly and asserting on the structured response shape:

```typescript
import { describe, it, expect } from "vitest";

describe("get_user", () => {
  it("returns user profile with expected shape", async () => {
    const result = await handleGetUser(
      { user_id: "test-user-id" },
      mockExtra
    );

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.tool).toBe("get_user");
    expect(parsed.error).toBeUndefined();
    expect(parsed.data).toHaveProperty("email");
    expect(parsed.meta.filtersApplied).toBeDefined();
  });

  it("returns error for missing user", async () => {
    const result = await handleGetUser(
      { user_id: "nonexistent" },
      mockExtra
    );

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe(true);
    expect(parsed.suggestion).toBeDefined();
  });
});
```

Test both success and error paths. Assert on `parsed.error`, `parsed.data`, and `parsed.meta` -- not on human-readable text which may change.

## Checklist

Before shipping a tool, verify:

- [ ] Returns `createToolResponse` with `{ tool, data, meta }` shape
- [ ] Error paths use `createErrorResponse` with `suggestion` field
- [ ] Annotations set (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- [ ] Logging: `tool.invoked` at entry, `tool.complete` at exit, `tool.error` on failure
- [ ] Request logger created via `createRequestLogger` (binds requestId, tool, userId)
- [ ] Integration test covers success path (asserts on data shape)
- [ ] Integration test covers error path (asserts on error + suggestion)
- [ ] Response includes `meta.pagination` if data can exceed default limit
- [ ] Response includes `meta.warnings` if data was truncated or filtered
