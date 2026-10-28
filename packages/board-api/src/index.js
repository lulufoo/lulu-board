import { createOwnedGraph, updateOwnedGraph } from './owned-graph.js';
import { saveSharedGraph } from './share-graph.js';
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
    if (request.method === 'POST' && url.pathname === '/graphs') {
      return createResponse(request, env);
    }
    if (request.method === 'PATCH' && url.pathname === '/graphs') {
      return updateResponse(request, env);
    }
    if (request.method === 'PATCH' && url.pathname === '/shares') {
      return shareResponse(request, env);
    }
    return new Response('Not Found', { status: 404, headers: CORS });
  },
};
