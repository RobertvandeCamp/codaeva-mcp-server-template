import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Creates a CallToolResult with both content (human-readable) and structuredContent (structured data)
 *
 * ALWAYS returns both:
 * - content: Human-readable text that LLM can understand and use for reasoning/responses
 * - structuredContent: Structured data for programmatic use
 *
 * This follows the FastMCP pattern where both fields provide maximum flexibility:
 * - LLMs can read the human-readable content
 * - Applications can use the structured data directly
 *
 * Handles undefined values gracefully by converting them to null
 * @param data - The structured data to include
 * @returns A properly formatted CallToolResult with both content and structuredContent
 */
export function createTextResult(data: unknown): CallToolResult {
  // Handle undefined gracefully by converting to null
  const safeData = data === undefined ? null : data;

  // Generate human-readable content based on data structure
  const content = generateHumanReadableContent(safeData);

  // Return both content (human-readable) and structuredContent (structured data)
  const result: CallToolResult = {
    content: [
      {
        type: "text",
        text: content,
      },
    ],
  };

  // Add structuredContent if data is an object or array (not null/undefined)
  // Type assertion: MCP SDK types don't include structuredContent yet, but the
  // protocol supports it. This workaround avoids patching the SDK types.
  if (safeData !== null && typeof safeData === "object") {
    (result as { structuredContent?: unknown }).structuredContent = safeData;
  }

  return result;
}

/**
 * Generates human-readable text content from structured data
 * Always includes JSON result in the text so LLMs can access structured data directly
 * @param data - The structured data to convert to human-readable text
 * @returns Human-readable text description with JSON included
 */
function generateHumanReadableContent(data: unknown): string {
  if (data === null || data === undefined) {
    return "No data available.";
  }

  let humanReadableText = "";

  // Handle error responses
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    (data as { error: unknown }).error === true &&
    "tool" in data &&
    "message" in data
  ) {
    const errorData = data as { tool: string; message: string; suggestion?: string };
    humanReadableText = `Error in ${errorData.tool}: ${errorData.message}`;
    if (errorData.suggestion) {
      humanReadableText += `\n\nSuggestion: ${errorData.suggestion}`;
    }
  }
  // Handle tool responses with data and count
  else if (
    typeof data === "object" &&
    data !== null &&
    "tool" in data &&
    "count" in data &&
    "data" in data
  ) {
    const toolData = data as {
      tool: string;
      count: number;
      limit?: number;
      hasMore?: boolean;
      data: unknown;
      message?: string;
      meta?: {
        filtersApplied?: Record<string, unknown>;
        pagination?: { total: number; limit: number; hasMore: boolean };
        metricDefinitions?: Record<string, string>;
        warnings?: string[];
      };
    };

    const toolName = toolData.tool.replace(/_/g, " ");
    humanReadableText = `${toolName}: Found ${toolData.count} result${toolData.count !== 1 ? "s" : ""}.`;

    const meta = toolData.meta ?? null;

    // Filters section (from meta.filtersApplied)
    if (meta?.filtersApplied) {
      const filterEntries = Object.entries(meta.filtersApplied)
        .filter(([, v]) => v !== null && v !== undefined);
      if (filterEntries.length > 0) {
        humanReadableText += `\nFilters: ${filterEntries.map(([k, v]) => `${k}=${v}`).join(", ")}`;
      }
    }

    // Pagination section (from meta.pagination, replaces legacy limit/hasMore)
    if (meta?.pagination) {
      const { total, limit, hasMore } = meta.pagination;
      if (hasMore) {
        humanReadableText += `\nShowing ${toolData.count} of ${total} results (limit: ${limit}). More results available.`;
      } else {
        humanReadableText += `\nShowing ${toolData.count} results.`;
      }
    } else if (toolData.limit !== undefined) {
      // Legacy limit/hasMore (backward compatibility for responses without meta)
      humanReadableText += ` (Limit: ${toolData.limit})`;
      if (toolData.hasMore) {
        humanReadableText += ` More results available but truncated due to limit.`;
      }
    }

    // Warnings section (from meta.warnings)
    if (meta?.warnings && meta.warnings.length > 0) {
      humanReadableText += `\nWarnings:`;
      for (const warning of meta.warnings) {
        humanReadableText += `\n- ${warning}`;
      }
    }

    // Add custom message if present (usually contains limit info)
    if (toolData.message) {
      humanReadableText += `\n\n${toolData.message}`;
    }

    humanReadableText += `\n\n`;

    // Add summary based on data type
    if (Array.isArray(toolData.data)) {
      if (toolData.data.length === 0) {
        humanReadableText += "No items found.";
      } else {
        humanReadableText += `Items:\n`;
        toolData.data.slice(0, 10).forEach((item: unknown, index: number) => {
          humanReadableText += `${index + 1}. ${formatItemSummary(item)}\n`;
        });
        if (toolData.data.length > 10) {
          humanReadableText += `\n... and ${toolData.data.length - 10} more.`;
        }
      }
    } else if (typeof toolData.data === "object" && toolData.data !== null) {
      // For complex objects, provide a summary
      const keys = Object.keys(toolData.data);
      humanReadableText += `Data includes: ${keys.slice(0, 5).join(", ")}`;
      if (keys.length > 5) {
        humanReadableText += `, and ${keys.length - 5} more field${keys.length > 5 ? "s" : ""}`;
      }
      humanReadableText += ".";
    } else {
      humanReadableText += `Result: ${String(toolData.data)}`;
    }

    // Metric Definitions section (from meta.metricDefinitions, after data)
    if (meta?.metricDefinitions) {
      const defEntries = Object.entries(meta.metricDefinitions);
      if (defEntries.length > 0) {
        humanReadableText += `\n\nMetric Definitions:`;
        for (const [key, description] of defEntries) {
          humanReadableText += `\n- ${key}: ${description}`;
        }
      }
    }
  }
  // Fallback: use JSON as human-readable text
  else {
    humanReadableText = JSON.stringify(data, null, 2);
  }

  // Always append the full JSON result so LLMs can access structured data directly
  const jsonString = JSON.stringify(data, null, 2);
  return `${humanReadableText}\n\n---\n\n**Full JSON Result:**\n\`\`\`json\n${jsonString}\n\`\`\``;
}

/**
 * Formats a single item for human-readable display
 * Always includes ID when present to make it easy for LLMs to find and use
 */
function formatItemSummary(item: unknown): string {
  if (item === null || item === undefined) {
    return "null";
  }

  if (typeof item === "string") {
    return item.length > 80 ? `${item.substring(0, 80)}...` : item;
  }

  if (typeof item === "object") {
    // Try to extract meaningful fields
    const obj = item as Record<string, unknown>;
    const id = "id" in obj ? obj.id : null;
    const idStr = id !== null && id !== undefined ? `ID: ${id}` : null;

    // For conversations: show ID and title
    if ("title" in obj && typeof obj.title === "string") {
      return idStr ? `${idStr} - ${obj.title}` : obj.title;
    }

    // For organizations: show ID and name
    if ("name" in obj && typeof obj.name === "string") {
      return idStr ? `${idStr} - ${obj.name}` : obj.name;
    }

    // For items with content
    if ("content" in obj && typeof obj.content === "string") {
      const content = obj.content.length > 60
        ? `${obj.content.substring(0, 60)}...`
        : obj.content;
      return idStr ? `${idStr} - ${content}` : content;
    }

    // For items with only ID
    if (idStr) {
      return idStr;
    }

    return JSON.stringify(item).substring(0, 80);
  }

  return String(item);
}
