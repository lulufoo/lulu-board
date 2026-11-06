/* board-mcp/meta.js — RFC 9728 protected-resource metadata */

function publicOrigin(env, request) {
  var origin = String(env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
  if (!origin && request) origin = new URL(request.url).origin;
  return origin;
}

function resourceUrl(env, request) {
  return publicOrigin(env, request) + "/mcp";
}

// The authorization server clients are told to use: this Worker's /auth/v1, which forwards to Supabase Auth.
export function authorizationServer(env, request) {
  return publicOrigin(env, request) + "/auth/v1";
}

// The issuer Supabase Auth puts in its own metadata and in every token it signs.
export function upstreamIssuer(env) {
  return String(env.SUPABASE_URL || "").replace(/\/$/, "") + "/auth/v1";
}

export function metadataDocument(env, request) {
  return {
    resource: resourceUrl(env, request),
    authorization_servers: [authorizationServer(env, request)],
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
