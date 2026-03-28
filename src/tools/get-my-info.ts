import { createToolHandler } from "../lib/handler.js";
import { createToolResponse } from "../lib/response.js";

/**
 * Tool definition for get_my_info
 */
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

interface GetMyInfoInput {}

/**
 * Tool handler for get_my_info
 */
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

    log.info({
      event: "tool.complete",
      durationMs: Date.now() - startTime,
    }, "Tool complete");

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
