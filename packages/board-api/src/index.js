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
      return authedCall(request, env, (token, _input, current) => readOwnedGraph(
        env,
        token,
        new URL(current.url).searchParams.get('diagram_id')
      ));
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
      return authedCall(request, env, (token, input) => readSharedGraph(env, token, input));
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
