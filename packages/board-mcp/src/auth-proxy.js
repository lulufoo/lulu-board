/* board-mcp/auth-proxy.js — pass four Supabase Auth OAuth endpoints through under /auth/v1.
 * Nothing here logs: the token request body carries the authorization code and the refresh token. */

var PREFIX = "/auth/v1";

// Path below PREFIX -> the one method it takes. Any other path is not forwarded.
var ROUTES = {
  "/oauth/authorize": "GET",
  "/oauth/token": "POST",
  "/oauth/userinfo": "GET",
  "/.well-known/jwks.json": "GET",
};

// Request headers that go upstream. Everything else is dropped, including every forwarding header
// the client set and the cookies: Auth would trust a client-set X-Forwarded-For as the source IP.
var REQUEST_HEADERS = ["authorization", "content-type", "accept", "accept-language", "user-agent"];

// Response headers that come back. The supabase.co bot-management cookie and the gateway and CDN
// headers stay out; this Worker's own edge adds its own.
var RESPONSE_HEADERS = ["content-type", "cache-control", "location", "www-authenticate", "retry-after", "x-sb-error-code"];

export function isAuthProxyPath(pathname) {
  return pathname === PREFIX || pathname.indexOf(PREFIX + "/") === 0;
}

export function buildUpstreamUrl(env, subPath, search) {
  return String(env.SUPABASE_URL || "").replace(/\/$/, "") + PREFIX + subPath + search;
}

// The client IP is the one Cloudflare put in CF-Connecting-IP; the client cannot change it.
export function buildRequestHeaders(request) {
  var headers = new Headers();
  REQUEST_HEADERS.forEach(function (name) {
    var value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  });
  var clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) headers.set("x-forwarded-for", clientIp);
  return headers;
}

export function buildResponse(upstream) {
  var headers = new Headers();
  RESPONSE_HEADERS.forEach(function (name) {
    var value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  });
  headers.set("access-control-allow-origin", "*");
  return new Response(upstream.body, { status: upstream.status, headers: headers });
}

export function buildErrorResponse(status, error, allow) {
  var headers = { "content-type": "application/json", "access-control-allow-origin": "*" };
  if (allow) headers.allow = allow;
  return new Response(JSON.stringify({ error: error }), { status: status, headers: headers });
}

export async function proxyAuthRequest(request, env) {
  var url = new URL(request.url);
  var subPath = url.pathname.slice(PREFIX.length);
  if (!Object.prototype.hasOwnProperty.call(ROUTES, subPath)) return new Response("Not found", { status: 404 });
  var method = ROUTES[subPath];
  if (request.method !== method) return buildErrorResponse(405, "method_not_allowed", method);
  var init = { method: method, headers: buildRequestHeaders(request), redirect: "manual" };
  if (method === "POST") init.body = request.body;
  var upstream;
  try {
    upstream = await fetch(buildUpstreamUrl(env, subPath, url.search), init);
  } catch (_error) {
    return buildErrorResponse(502, "upstream_unreachable");
  }
  return buildResponse(upstream);
}
