import { createOwnedGraph, updateOwnedGraph } from './owned-graph.js';
import { saveSharedGraph } from './share-graph.js';
import { changeShareSetting } from './share-settings.js';
import { deleteOwnedGraphs } from './graph-delete.js';
import { reorderGroup } from './group-reorder.js';
import { readOwnedGraph } from './graph-read.js';
import { listMine, loadGroupShells } from './mine-lists.js';
import { searchGraphs } from './graph-search.js';
import { listOutgoingShares, readOwnShareState, readSharedGraph } from './share-reads.js';
import { readShortLink } from './short-link.js';
import { verifyAccessToken } from './jwt.js';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'application/json' }, CORS),
  });
}

function gzipAccepted(header) {
  return String(header || '').toLowerCase().split(',').some((part) => {
    const bits = part.trim().split(';').map((item) => item.trim());
    if (bits[0] !== 'gzip') return false;
    const quality = bits.find((item) => item.startsWith('q='));
    if (!quality) return true;
    const q = Number(quality.slice(2));
    return Number.isFinite(q) && q > 0;
  });
}

function clientAcceptsGzip(request) {
  const original = request.cf && request.cf.clientAcceptEncoding;
  return gzipAccepted(request.headers.get('accept-encoding')) || gzipAccepted(original);
}

async function gzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gzipJsonResponse(request, response) {
  if (!response || response.status !== 200 || !clientAcceptsGzip(request)) return response;
  const plain = new TextEncoder().encode(await response.text());
  const packed = await gzipBytes(plain);
  if (packed.byteLength >= plain.byteLength) {
    return new Response(plain, { status: 200, headers: response.headers });
  }
  const headers = new Headers(response.headers);
  headers.set('content-encoding', 'gzip');
  headers.delete('content-length');
  return new Response(packed, { status: 200, headers: headers, encodeBody: 'manual' });
}

function bearer(request) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

async function publicCall(request, env, run) {
  let input;
  try {
    input = await request.json();
  } catch (_error) {
    return json({ error: 'invalid_request', message: 'invalid json' }, 400);
  }
  try {
    return json(await run(input), 200);
  } catch (error) {
    const status = error.status || 500;
    const code = error.error || 'db_error';
    const body = { error: code };
    if (error.message && code !== 'unauthorized') body.message = error.message;
    return json(body, status);
  }
}

async function authedCall(request, env, run) {
  const token = bearer(request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  try {
    await verifyAccessToken(env, token);
  } catch (_error) {
    return json({ error: 'unauthorized' }, 401);
  }
  let input = {};
  if (request.method !== 'GET') {
    try {
      input = await request.json();
    } catch (_error) {
      return json({ error: 'invalid_request', message: 'invalid json' }, 400);
    }
  }
  try {
    return json(await run(token, input, request), 200);
  } catch (error) {
    const status = error.status || 500;
    const code = error.error || 'db_error';
    const body = { error: code };
    if (error.message && code !== 'unauthorized') body.message = error.message;
    return json(body, status);
  }
}

async function shareSettingResponse(request, env, action) {
  const token = bearer(request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  try {
    await verifyAccessToken(env, token);
  } catch (_error) {
    return json({ error: 'unauthorized' }, 401);
  }
  let input;
  try {
    input = await request.json();
  } catch (_error) {
    return json({ error: 'invalid_request', message: 'invalid json' }, 400);
  }
  try {
    return json(await changeShareSetting(env, token, action, input), 200);
  } catch (error) {
    const status = error.status || 500;
    const code = error.error || 'db_error';
    const body = { error: code };
    if (error.message && code !== 'unauthorized') body.message = error.message;
    return json(body, status);
  }
}

async function shareResponse(request, env) {
  const token = bearer(request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  try {
    await verifyAccessToken(env, token);
  } catch (_error) {
    return json({ error: 'unauthorized' }, 401);
  }
  let input;
  try {
    input = await request.json();
  } catch (_error) {
    return json({ error: 'invalid_request', message: 'invalid json' }, 400);
  }
  try {
    return json(await saveSharedGraph(env, token, input), 200);
  } catch (error) {
    const status = error.status || 500;
    const code = error.error || 'db_error';
    const body = { error: code };
    if (error.message && code !== 'unauthorized' && code !== 'conflict') body.message = error.message;
    return json(body, status);
  }
}

async function updateResponse(request, env) {
  const token = bearer(request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  try {
    await verifyAccessToken(env, token);
  } catch (_error) {
    return json({ error: 'unauthorized' }, 401);
  }
  let input;
  try {
    input = await request.json();
  } catch (_error) {
    return json({ error: 'invalid_request', message: 'invalid json' }, 400);
  }
  try {
    return json(await updateOwnedGraph(env, token, input), 200);
  } catch (error) {
    const status = error.status || 500;
    const code = error.error || 'db_error';
    const body = { error: code };
    if (error.message && code !== 'unauthorized' && code !== 'conflict') body.message = error.message;
    return json(body, status);
  }
}

async function createResponse(request, env) {
  const token = bearer(request);
  if (!token) return json({ error: 'unauthorized' }, 401);
  try {
    await verifyAccessToken(env, token);
  } catch (_error) {
    return json({ error: 'unauthorized' }, 401);
  }
  let input;
  try {
    input = await request.json();
  } catch (_error) {
    return json({ error: 'invalid_request', message: 'invalid json' }, 400);
  }
  try {
    return json(await createOwnedGraph(env, token, input), 200);
  } catch (error) {
    const status = error.status || 500;
    const code = error.error || 'db_error';
    const body = { error: code };
    if (error.message && code !== 'unauthorized') body.message = error.message;
    return json(body, status);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response('ok', { status: 200, headers: CORS });
    }
    if (request.method === 'GET' && url.pathname === '/graphs') {
      return gzipJsonResponse(request, await authedCall(request, env, (token, _input, current) => readOwnedGraph(
        env,
        token,
        new URL(current.url).searchParams.get('diagram_id')
      )));
    }
    if (request.method === 'POST' && url.pathname === '/graphs') {
      return createResponse(request, env);
    }
    if (request.method === 'PATCH' && url.pathname === '/graphs') {
      return updateResponse(request, env);
    }
    if (request.method === 'PATCH' && url.pathname === '/shares') {
      return shareResponse(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/search') {
      return authedCall(request, env, (token, input) => searchGraphs(env, token, input));
    }
    if (request.method === 'POST' && url.pathname === '/mine') {
      return authedCall(request, env, (token, input) => listMine(env, token, input));
    }
    if (request.method === 'POST' && url.pathname === '/groups/shells') {
      return authedCall(request, env, (token, input) => loadGroupShells(env, token, input));
    }
    if (request.method === 'POST' && url.pathname === '/graphs/delete') {
      return authedCall(request, env, (token, input) => deleteOwnedGraphs(env, token, input));
    }
    if (request.method === 'POST' && url.pathname === '/groups/reorder') {
      return authedCall(request, env, (token, input) => reorderGroup(env, token, input));
    }
    if (request.method === 'POST' && url.pathname === '/shares/get') {
      const token = bearer(request);
      if (token) return authedCall(request, env, (user, input) => readSharedGraph(env, user, input));
      return publicCall(request, env, (input) => readSharedGraph(env, env.SUPABASE_PUBLISHABLE_KEY, input));
    }
    if (request.method === 'POST' && url.pathname === '/shares/state') {
      return authedCall(request, env, (token, input) => readOwnShareState(env, token, input));
    }
    if (request.method === 'POST' && url.pathname === '/shares/outgoing') {
      return authedCall(request, env, (token) => listOutgoingShares(env, token));
    }
    if (request.method === 'POST' && url.pathname === '/shares/open') {
      return shareSettingResponse(request, env, 'open_share');
    }
    if (request.method === 'POST' && url.pathname === '/shares/rotate') {
      return shareSettingResponse(request, env, 'rotate_share');
    }
    if (request.method === 'POST' && url.pathname === '/shares/unshare') {
      return shareSettingResponse(request, env, 'unshare');
    }
    if (request.method === 'POST' && url.pathname === '/shares/role') {
      return shareSettingResponse(request, env, 'set_share_role');
    }
    if (request.method === 'POST' && url.pathname === '/short-links/get') {
      return publicCall(request, env, (input) => readShortLink(env, input));
    }
    return new Response('Not Found', { status: 404, headers: CORS });
  },
};
