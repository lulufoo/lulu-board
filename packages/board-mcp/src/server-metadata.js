/* board-mcp/server-metadata.js — RFC 8414 authorization server metadata, served by this Worker.
 * It is Supabase's own document with the six address fields moved under this Worker's /auth/v1,
 * so a client that reads it talks to the proxy routes. The other fields are copied as they are. */

import { buildErrorResponse } from "./auth-proxy.js";
import { authorizationServer, json, upstreamIssuer } from "./meta.js";

var PATH = "/.well-known/oauth-authorization-server/auth/v1";
var REWRITTEN = ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri", "userinfo_endpoint", "registration_endpoint"];
var TTL_MS = 5 * 60 * 1000;
var CLIENT_CACHE_SECONDS = 300;

// The last good copy of Supabase's document: { url, document, at }. One per Worker instance.
var cached = null;

export function isServerMetadataPath(pathname) {
  return pathname === PATH;
}

// Supabase's document, from the cache while it is fresh, else from Supabase. When Supabase cannot be read,
// the last good copy is used even if it is old; with no copy at all the result is null.
async function readUpstream(env) {
  var url = String(env.SUPABASE_URL || "").replace(/\/$/, "") + PATH;
  var now = Date.now();
  if (cached && cached.url === url && now - cached.at < TTL_MS) return cached.document;
  try {
    var res = await fetch(url, { headers: { accept: "application/json" } });
    var document = res.ok ? await res.json() : null;
    if (document && typeof document === "object" && !Array.isArray(document)) {
      cached = { url: url, document: document, at: now };
      return document;
    }
  } catch (_error) {
    // fall through to the last good copy
  }
  return cached && cached.url === url ? cached.document : null;
}

// The document with the six fields under our issuer, or null when Supabase's document is not the shape we expect.
// A document that is only half rewritten would send a client to Supabase for some steps, so none is served then.
function rewrite(upstream, fromIssuer, toIssuer) {
  if (upstream.issuer !== fromIssuer) return null;
  var out = Object.assign({}, upstream);
  for (var i = 0; i < REWRITTEN.length; i += 1) {
    var value = upstream[REWRITTEN[i]];
    if (typeof value !== "string") return null;
    if (value !== fromIssuer && value.indexOf(fromIssuer + "/") !== 0) return null;
    out[REWRITTEN[i]] = toIssuer + value.slice(fromIssuer.length);
  }
  return out;
}

export async function serverMetadataResponse(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return buildErrorResponse(405, "method_not_allowed", "GET, HEAD");
  var upstream = await readUpstream(env);
  var document = upstream ? rewrite(upstream, upstreamIssuer(env), authorizationServer(env, request)) : null;
  if (!document) return buildErrorResponse(502, "authorization_server_metadata_unavailable");
  var res = json(document);
  res.headers.set("cache-control", "public, max-age=" + CLIENT_CACHE_SECONDS);
  if (request.method === "HEAD") return new Response(null, { status: res.status, headers: res.headers });
  return res;
}
