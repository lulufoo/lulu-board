/* board-mcp Worker — Streamable HTTP MCP + Supabase user JWT */
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { getGraph, createGraph, saveGraph } from "./graphs.js";
import { verifyAccessToken } from "./jwt.js";
import { json, metadataDocument, unauthorized } from "./meta.js";
import { brandResponse, isBrandPath, PUBLIC_WEB_ORIGIN, serverInfo } from "./brand.js";
import { GRAPH_ID_RE } from "../../board-core/index.js";

const DIAGRAM_ID = z.string().regex(GRAPH_ID_RE).describe("Cloud row id: b_ + 8 lowercase hex");

function toolText(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function toolError(error) {
  return {
    isError: true,
    content: [{ type: "text", text: error && error.message ? error.message : String(error) }],
  };
}

function mcpDoc(row) {
  if (!row) return row;
  return {
    diagram_id: row.graph_id,
    title: row.title,
    bmd: row.bmd,
    version: row.version,
    updated_at: row.updated_at,
    group_id: row.group_id,
    url: PUBLIC_WEB_ORIGIN + "/#b:" + row.graph_id,
  };
}

function createServer(env, identity, token) {
  const server = new McpServer(serverInfo(env));
  server.registerTool("whoami", { description: "Return the authorized Lulu Board account.", inputSchema: {} }, async () => (
    toolText({ email: identity.email, user_id: identity.user_id })
  ));
  server.registerTool("get_diagram", {
    description: "Load one owned diagram by id. Returns url plus diagram_id. group_id is the group this diagram_id belongs to.",
    inputSchema: { diagram_id: DIAGRAM_ID },
  }, async ({ diagram_id }) => {
    try { return toolText(mcpDoc(await getGraph(env, token, diagram_id))); }
    catch (error) { return toolError(error); }
  });
  server.registerTool("create_diagram", {
    description: "Insert a new owned diagram and return url plus diagram_id. group_id is the group this diagram_id belongs to. Optional group_id joins that group on the current account so this diagram is classified with other diagrams that share it. Omit group_id to create a new group.",
    inputSchema: {
      bmd: z.string(),
      diagram_id: DIAGRAM_ID.optional(),
      group_id: z.string().optional().describe(
        "If set, join this group on the current account so this diagram_id is classified with other diagrams that share the same group_id. Omit to create a new group."
      ),
    },
  }, async ({ bmd, diagram_id, group_id }) => {
    try { return toolText(mcpDoc(await createGraph(env, token, identity.user_id, bmd, diagram_id, group_id))); }
    catch (error) { return toolError(error); }
  });
  server.registerTool("save_diagram", {
    description: "Update an owned diagram when expected_version still matches. row includes url and diagram_id. row.group_id is the group this diagram_id belongs to.",
    inputSchema: { diagram_id: DIAGRAM_ID, bmd: z.string(), expected_version: z.number() },
  }, async ({ diagram_id, bmd, expected_version }) => {
    try {
      var result = await saveGraph(env, token, diagram_id, bmd, expected_version);
      return toolText({ conflict: result.conflict, row: mcpDoc(result.row) });
    }
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
  allowedHostnames: ["mcp.luluboard.app", "mcp.luluvela.app", "localhost", "127.0.0.1"],
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
    if ((request.method === "GET" || request.method === "HEAD") && isBrandPath(url.pathname)) {
      const icon = brandResponse(url.pathname);
      if (request.method === "HEAD") return new Response(null, { status: icon.status, headers: icon.headers });
      return icon;
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
