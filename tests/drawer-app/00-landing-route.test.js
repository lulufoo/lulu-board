'use strict';
const assert = require('assert');
const Head = require('../../packages/drawer-app/js/00-early-head.js');
const Route = require('../../packages/drawer-app/js/00-cloud-route.js');

function fakeStorage(entries) {
  const keys = Object.keys(entries);
  return {
    length: keys.length,
    key: (i) => (i < keys.length ? keys[i] : null),
    getItem: (k) => (k in entries ? entries[k] : null),
  };
}

const session = fakeStorage({ 'sb-abcdef-auth-token': JSON.stringify({ access_token: 'a', refresh_token: 'r' }) });
const empty = fakeStorage({ 'drawer.ui': '{}' });
const BLANK = '#z:eJyrVkrKTVGyUkrKTyxKUYhRCs0rySzJSU2JUYrJU9JRKkstKs7Mz1OyMqwFACtUDgY';
const BOARD = '#b:b_29b9c39c';
const SHARE = '#s:s_0123456789abcdef0123456789abcdef';

// legal hash = format only, agrees with the cloud route
assert.strictEqual(Head.isLegalHash(BOARD), true);
assert.strictEqual(Head.isLegalHash(SHARE), true);
assert.strictEqual(Head.isLegalHash(BLANK), true);
assert.strictEqual(Head.isLegalHash(''), false);
assert.strictEqual(Head.isLegalHash('#'), false);
assert.strictEqual(Head.isLegalHash('#foo'), false);
assert.strictEqual(Head.isLegalHash('#z:'), false);
assert.strictEqual(Head.isLegalHash('#z:has space'), false);
assert.strictEqual(Head.isLegalHash('#b:b_29B9c39c'), false);
assert.strictEqual(Head.isLegalHash('#s:s_short'), false);
assert.strictEqual(Boolean(Route.cloudBoardIdFromHash(BOARD)), Head.isLegalHash(BOARD));
assert.strictEqual(Boolean(Route.cloudShareIdFromHash(SHARE)), Head.isLegalHash(SHARE));

// session marker
assert.strictEqual(Head.hasStoredSession(session), true);
assert.strictEqual(Head.hasStoredSession(empty), false);
assert.strictEqual(Head.hasStoredSession(null), false);
assert.strictEqual(Head.hasStoredSession(fakeStorage({ 'sb-abcdef-auth-token': 'not json' })), false);
assert.strictEqual(Head.hasStoredSession(fakeStorage({ 'sb-abcdef-auth-token': 'null' })), false);
assert.strictEqual(Head.hasStoredSession(fakeStorage({ 'other-auth-token': '{"access_token":"a"}' })), false);

// routing matrix
const route = (o) => Head.shouldShowLanding(Object.assign({ pathname: '/', hash: '', search: '', storage: empty }, o));
assert.strictEqual(route({}), true, 'empty address, signed out -> landing');
assert.strictEqual(route({ storage: session }), false, 'empty address, signed in -> workspace');
assert.strictEqual(route({ hash: '#foo' }), true, 'invalid hash behaves like empty, signed out');
assert.strictEqual(route({ hash: '#foo', storage: session }), false, 'invalid hash behaves like empty, signed in');
for (const hash of [BOARD, SHARE, BLANK]) {
  assert.strictEqual(route({ hash }), false, 'legal link -> workspace: ' + hash);
  assert.strictEqual(route({ hash, storage: session }), false);
}
assert.strictEqual(route({ search: '?code=abc' }), false, 'OAuth return must not be redirected');
assert.strictEqual(route({ search: '?error=access_denied' }), false);
assert.strictEqual(route({ pathname: '/index.html' }), true);
assert.strictEqual(route({ pathname: '/landing/' }), false);
assert.strictEqual(route({ pathname: '/oauth/consent/' }), false);
assert.strictEqual(route({ storage: null }), true);


// /start redirect helpers (LB-353): rewrite to /, keep search, drop hash; never landing
assert.strictEqual(Head.isStartPath('/start'), true);
assert.strictEqual(Head.isStartPath('/start/'), true);
assert.strictEqual(Head.isStartPath('/'), false);
assert.strictEqual(Head.isStartPath('/landing/'), false);
assert.strictEqual(Head.isStartPath('/startup'), false);
assert.strictEqual(Head.isStartPath('/start/extra'), false);
assert.strictEqual(Head.rewriteStartToRoot({ pathname: '/start', search: '' }), '/');
assert.strictEqual(Head.rewriteStartToRoot({ pathname: '/start/', search: '' }), '/');
assert.strictEqual(Head.rewriteStartToRoot({ pathname: '/start', search: '?code=abc' }), '/?code=abc');
assert.strictEqual(Head.rewriteStartToRoot({ pathname: '/start/', search: '?code=abc&state=1' }), '/?code=abc&state=1');
assert.strictEqual(Head.rewriteStartToRoot({ pathname: '/start', search: '?code=abc', hash: '#z:deadbeef' }), '/?code=abc', 'hash dropped');
assert.strictEqual(Head.rewriteStartToRoot({ pathname: '/', search: '' }), null);
assert.strictEqual(route({ pathname: '/start' }), false, '/start must not show landing');
assert.strictEqual(route({ pathname: '/start/' }), false, '/start/ must not show landing');
assert.strictEqual(route({ pathname: '/start', hash: '#foo' }), false);
assert.strictEqual(route({ pathname: '/start', search: '?code=abc' }), false);

console.log('ok landing-route');
