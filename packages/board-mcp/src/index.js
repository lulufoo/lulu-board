/* board-mcp Worker — Streamable HTTP MCP + Supabase user JWT */
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { getBoard, createBoard, saveBoard } from "./boards.js";
import { verifyAccessToken } from "./jwt.js";
import { json, metadataDocument, unauthorized } from "./meta.js";

function toolText(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function toolError(error) {
  return {
    isError: true,
    content: [{ type: "text", text: error && error.message ? error.message : String(error) }],
  };
}

function createServer(env, identity, token) {
  const server = new McpServer({ name: "lulu-board", version: "1.0.0" });
  server.registerTool("whoami", { description: "Return the authorized Lulu Board account.", inputSchema: {} }, async () => (
    toolText({ email: identity.email, user_id: identity.user_id })
  ));
  server.registerTool("get_board", {
    description: "Load one owned board by id. group_id in the result is the group this board_id belongs to.",
    inputSchema: { board_id: z.string() },
  }, async ({ board_id }) => {
    try { return toolText(await getBoard(env, token, board_id)); }
    catch (error) { return toolError(error); }
  });
  server.registerTool("create_board", {
    description: "Insert a new owned board and return its cloud id. group_id in the result is the group this board_id belongs to. Optional group_id joins that group on the current account so this board is classified with other board ids that share it. Omit group_id to create a new group.",
    inputSchema: {
      bmd: z.string(),
      board_id: z.string().optional(),
      group_id: z.string().optional().describe(
        "If set, join this group on the current account so this board_id is classified with other board ids that share the same group_id. Omit to create a new group."
      ),
    },
  }, async ({ bmd, board_id, group_id }) => {
    try { return toolText(await createBoard(env, token, identity.user_id, bmd, board_id, group_id)); }
    catch (error) { return toolError(error); }
  });
  server.registerTool("save_board", {
    description: "Update an owned board when expected_version still matches. row.group_id is the group this board_id belongs to.",
    inputSchema: { board_id: z.string(), bmd: z.string(), expected_version: z.number() },
  }, async ({ board_id, bmd, expected_version }) => {
    try { return toolText(await saveBoard(env, token, board_id, bmd, expected_version)); }
    catch (error) { return toolError(error); }
  });
  return server;
}

function isMetaPath(path) {
  return path === "/.well-known/oauth-protected-resource"
    || path === "/.well-known/oauth-protected-resource/mcp";
}

const handler = createMcpHandler((context) => {
  const extra = context.authInfo && context.authInfo.extra;
  return createServer(extra.env, extra.identity, extra.token);
}, {
  route: "/mcp",
  allowedHostnames: ["mcp.luluboard.app", "localhost", "127.0.0.1"],
  allowedOriginHostnames: ["localhost", "127.0.0.1"],
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "Authorization, Content-Type",
          "access-control-allow-methods": "GET, POST, OPTIONS",
        },
      });
    }
    if (request.method === "GET" && isMetaPath(url.pathname)) {
      return json(metadataDocument(env, request));
    }
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    const header = request.headers.get("authorization") || "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (!token) return unauthorized(env, request);
    let identity;
    try {
      identity = await verifyAccessToken(env, token);
    } catch (_error) {
      return unauthorized(env, request);
    }
    return handler.fetch(request, {
      authInfo: {
        token: token,
        clientId: identity.client_id || "lulu-board",
        scopes: [],
        extra: { env: env, identity: identity, token: token },
      },
    });
  },
};
