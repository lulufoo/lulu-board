/* Which routes each channel may call.
 * A channel is the `channel` claim the sign-in hook puts in the access token:
 * `web` for the site, `mcp` for clients that signed in through the MCP Worker, `unknown` for a client nobody registered. */

// Keys are "METHOD /path", the path without its query string. `web` is the site itself and may call every route.
// The `mcp` routes are the ones packages/board-mcp/src/graphs.js calls.
export const CHANNEL_ROUTES = Object.freeze({
  web: '*',
  mcp: Object.freeze([
    'POST /groups/shells',
    'GET /graphs',
    'POST /graphs',
    'PATCH /graphs',
    'POST /search',
  ]),
});

// 'ok' lets the request on.
// 'forbidden' (403): a channel we know calls a route it may not.
// 'unauthorized' (401): the channel is missing, `unknown`, or not one we know, so the token is not accepted at all.
export function channelVerdict(channel, method, pathname) {
  if (typeof channel !== 'string' || !Object.prototype.hasOwnProperty.call(CHANNEL_ROUTES, channel)) return 'unauthorized';
  const allowed = CHANNEL_ROUTES[channel];
  if (allowed === '*') return 'ok';
  return allowed.includes(method + ' ' + pathname) ? 'ok' : 'forbidden';
}
