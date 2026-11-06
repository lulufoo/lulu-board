/* board-mcp/register-proxy.js — client registration through the Worker, then one registry write.
 * Nothing here logs: the 201 body holds client_secret and the registry call carries the gateway secret. */

import { buildErrorResponse, buildRequestHeaders, buildResponse, buildUpstreamUrl } from "./auth-proxy.js";

var REGISTER_PATH = "/auth/v1/oauth/clients/register";
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRegisterPath(pathname) {
  return pathname === REGISTER_PATH;
}

// Returns the client_id of a registration reply, or "" when the reply is not a usable registration.
function readClientId(text) {
  try {
    var data = JSON.parse(text);
    var id = data && typeof data.client_id === "string" ? data.client_id : "";
    return UUID_RE.test(id) ? id : "";
  } catch (_error) {
    return "";
  }
}

// One call to the registry function. The gateway secret rides in a request header that no client sees.
async function recordClientChannel(env, clientId) {
  try {
    var res = await fetch(String(env.SUPABASE_URL).replace(/\/$/, "") + "/rest/v1/rpc/record_client_channel", {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        "content-type": "application/json",
        "x-board-gateway": env.REGISTER_GATEWAY_SECRET,
      },
      body: JSON.stringify({ p_client_id: clientId }),
    });
    return res.ok;
  } catch (_error) {
    return false;
  }
}

// Forward the registration. A 2xx reply is handed back only after its client_id is on the registry;
// when that write fails the client gets a 502 and no client_id, so no unregistered client is in use.
export async function proxyRegisterRequest(request, env) {
  if (request.method !== "POST") return buildErrorResponse(405, "method_not_allowed", "POST");
  if (!env.REGISTER_GATEWAY_SECRET || !env.SUPABASE_PUBLISHABLE_KEY) return buildErrorResponse(503, "registration_unavailable");
  var url = new URL(request.url);
  var upstream;
  var text;
  try {
    upstream = await fetch(buildUpstreamUrl(env, "/oauth/clients/register", url.search), {
      method: "POST",
      headers: buildRequestHeaders(request),
      body: request.body,
      redirect: "manual",
    });
    text = await upstream.text();
  } catch (_error) {
    return buildErrorResponse(502, "upstream_unreachable");
  }
  var relay = new Response(text || null, { status: upstream.status, headers: upstream.headers });
  if (upstream.status < 200 || upstream.status > 299) return buildResponse(relay);
  var clientId = readClientId(text);
  if (!clientId || !(await recordClientChannel(env, clientId))) return buildErrorResponse(502, "client_registration_failed");
  return buildResponse(relay);
}
