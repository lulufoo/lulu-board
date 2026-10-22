/* board-mcp/jwt.js — confirm a user JWT with Auth, then read claims */

export function decodePayload(token) {
  var parts = String(token || "").split(".");
  if (parts.length < 2) throw new Error("invalid token");
  var raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  while (raw.length % 4) raw += "=";
  var json = JSON.parse(atob(raw));
  if (!json || typeof json !== "object") throw new Error("invalid token");
  return json;
}

export async function verifyAccessToken(env, token) {
  var claims = decodePayload(token);
  var issuer = String(env.SUPABASE_URL || "").replace(/\/$/, "") + "/auth/v1";
  if (claims.iss && claims.iss !== issuer) throw new Error("invalid issuer");
  if (claims.exp && Number(claims.exp) * 1000 <= Date.now()) throw new Error("token expired");
  var res = await fetch(issuer + "/user", {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + token,
    },
  });
  var body = await res.json().catch(function () { return {}; });
  if (!res.ok || !body.id) throw new Error(body.msg || body.error || "unauthorized");
  return {
    user_id: body.id,
    email: body.email || "",
    client_id: claims.client_id || "",
  };
}
