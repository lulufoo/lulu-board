/* Personal access tokens through board-api. The page never stores the plaintext. */
import { cloudSession } from './cloud-state.js';

function tokenHeaders() {
  var access = cloudSession && cloudSession.access_token;
  if (!access) throw new Error('Sign in to manage tokens');
  return { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' };
}

function readError(body, fallback) {
  return (body && (body.message || body.error)) || fallback;
}

async function tokenRequest(path, method, payload) {
  var headers = tokenHeaders();
  var init = { method: method, headers: headers };
  if (payload !== undefined) init.body = JSON.stringify(payload);
  else delete headers['Content-Type'];
  var response = await fetch('https://api.luluboard.app' + path, init);
  var text = await response.text();
  var body = null;
  if (text) {
    try { body = JSON.parse(text); } catch (_error) { body = { message: text }; }
  }
  if (!response.ok) throw new Error(readError(body, 'HTTP ' + response.status));
  return body;
}

function publicRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    prefix: row.prefix || '',
    expires_at: row.expires_at || '',
    created_at: row.created_at || '',
  };
}

export async function cloudListTokens() {
  var body = await tokenRequest('/tokens', 'GET');
  return (Array.isArray(body) ? body : []).map(publicRow).filter(Boolean);
}

export async function cloudCreateToken(name, days) {
  var row = await tokenRequest('/tokens', 'POST', { name: name, expires_in_days: days });
  if (!row || !row.token) throw new Error('Could not create token');
  return { meta: publicRow(row), token: row.token };
}

export async function cloudRevokeToken(id) {
  return tokenRequest('/tokens/revoke', 'POST', { id: id });
}
