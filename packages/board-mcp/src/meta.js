/* board-mcp/meta.js — RFC 9728 protected-resource metadata */

function resourceUrl(env, request) {
  var origin = String(env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
  if (!origin && request) origin = new URL(request.url).origin;
  return origin + "/mcp";
}

function authorizationServer(env) {
  return String(env.SUPABASE_URL || "").replace(/\/$/, "") + "/auth/v1";
}

export function metadataDocument(env, request) {
  return {
    resource: resourceUrl(env, request),
    authorization_servers: [authorizationServer(env)],
    bearer_methods_supported: ["header"],
  };
}

export function unauthorized(env, request) {
  var meta = resourceUrl(env, request).replace(/\/mcp$/, "") + "/.well-known/oauth-protected-resource";
  return new Response(JSON.stringify({ error: "invalid_token" }), {
    status: 401,
    headers: {
      "content-type": "application/json",
      "www-authenticate": 'Bearer realm="lulu-board", resource_metadata="' + meta + '"',
      "access-control-allow-origin": "*",
    },
  });
}

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}
