# MCP Design Principles

Five principles for designing MCP tools that work well with LLM agents. Each principle includes rationale and DO/DON'T examples.

## Outcomes Not Operations

Tools should describe WHAT they return, not HOW they work internally. LLMs select tools based on descriptions -- implementation details are noise.

**DO:**
```
Returns the authenticated user's profile including email, full_name, role, and admin status.
```

**DON'T:**
```
Queries the user_profiles table via Supabase with RLS filtering and joins on role_assignments.
```

The LLM needs to know "this gives me user info" -- not "this runs a SQL query." Internal mechanics change; outcomes stay stable.

## Flatten Arguments

LLMs produce flat key-value pairs more reliably than deeply nested JSON. Prefer flat input schemas.

**DO:**
```typescript
inputSchema: {
  type: "object",
  properties: {
    article: { type: "string", description: "Article number" },
    dc: { type: "string", description: "Distribution center code" },
    status: { type: "string", enum: ["active", "archived"] },
  },
}
```

**DON'T:**
```typescript
inputSchema: {
  type: "object",
  properties: {
    filters: {
      type: "object",
      properties: {
        article: { type: "string" },
        location: {
          type: "object",
          properties: { dc: { type: "string" } },
        },
      },
    },
  },
}
```

Nested schemas increase hallucination risk and token cost. If you have more than 5-6 parameters, consider splitting into two tools rather than nesting.

## Errors as Prompts

Error responses should guide the LLM to self-correct. Every error needs three things: what failed, why, and what to try instead.

**DO:**
```typescript
createErrorResponse(
  "get_order",
  "No orders found for article X-1234 in DC Amsterdam",
  "Check if the article number is correct, or call list_articles to see available articles."
);
// Output: { error: true, tool: "get_order", message: "...", suggestion: "..." }
```

**DON'T:**
```typescript
createErrorResponse("get_order", "ENOENT");
// LLM has no idea what went wrong or how to recover
```

The `suggestion` field turns dead-end errors into actionable next steps. Without it, the LLM either retries the same failing call or gives up.

## Token Budget Awareness

MCP responses consume LLM context window. Unbounded results waste tokens and can hit limits.

**Apply internal limits:**
- Default to 50-100 items per response.
- Include `meta.pagination` so the LLM knows more data exists:

```typescript
meta: {
  pagination: { total: 1420, limit: 50, hasMore: true },
  warnings: ["Results limited to 50 items. Use offset parameter for next page."],
}
```

**Truncate large text fields:**
- Clip descriptions, notes, or content fields to a reasonable length (200-500 chars).
- Flag truncation in `meta.warnings`.

**Aggregate when possible:**
- Return summary statistics instead of raw rows when the question is "how many" or "what's the total."
- Offer both a summary tool and a detail tool rather than one tool that returns everything.

## Tool Descriptions as Contracts

The `description` field IS the API contract for the LLM. It determines when the tool gets selected and how arguments get populated.

Structure every description with a WHEN TO USE block:

```typescript
description: `Returns the authenticated user's profile information including
name, email, role, and admin status.

WHEN TO USE:
- User asks "who am I?", "what's my role?", "am I an admin?"
- At the start of a conversation to establish user context
- To check permissions before suggesting actions

Returns: email, full_name, role (e.g. admin/viewer), is_admin boolean.`
```

Key elements:
- **First line:** What the tool returns (outcome, not operation).
- **WHEN TO USE:** Trigger phrases and scenarios the LLM should match on.
- **Returns:** Explicit list of fields so the LLM knows what data to expect.

Avoid vague descriptions like "Manages user data" -- the LLM cannot distinguish that from a create, update, or delete operation.

## Summary

| Principle | Core Idea | Key Takeaway |
|-----------|-----------|--------------|
| Outcomes Not Operations | Describe WHAT, not HOW | Descriptions state the result, not the mechanism |
| Flatten Arguments | Flat > nested schemas | Reduces hallucination, improves reliability |
| Errors as Prompts | Errors guide recovery | Always include a `suggestion` field |
| Token Budget Awareness | Limit response size | Default limits + pagination metadata |
| Tool Descriptions as Contracts | Description = API contract | WHEN TO USE block in every description |
