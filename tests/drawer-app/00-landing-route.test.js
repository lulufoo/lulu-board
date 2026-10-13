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
assert.strictEqual(route({ search: '?ws=1&code=abc' }), false, 'LB-356 OAuth return /?ws=1&code= stays on workspace');
assert.strictEqual(route({ search: '?code=abc&ws=1' }), false, 'LB-356 OAuth return /?code=&ws=1 stays on workspace');
assert.strictEqual(route({ search: '?error=access_denied' }), false);
assert.strictEqual(route({ search: '?ws=1&error=access_denied' }), false);
assert.strictEqual(Head.isAuthReturn('?ws=1&code=abc'), true);
assert.strictEqual(Head.isAuthReturn('?code=abc&ws=1'), true);
assert.strictEqual(Head.isAuthReturn('?ws=1'), false);
assert.strictEqual(route({ pathname: '/index.html' }), true);
assert.strictEqual(route({ pathname: '/landing/' }), false);
assert.strictEqual(route({ pathname: '/oauth/consent/' }), false);
assert.strictEqual(route({ storage: null }), true);

// /?ws=1 forced workspace (LB-359); /start abandoned
assert.strictEqual(Head.isForcedWorkspace('?ws=1'), true);
assert.strictEqual(Head.isForcedWorkspace('?ws=true'), true);
assert.strictEqual(Head.isForcedWorkspace('?ws=yes'), true);
assert.strictEqual(Head.isForcedWorkspace('?foo=1&ws=1'), true);
assert.strictEqual(Head.isForcedWorkspace('?ws=0'), false);
assert.strictEqual(Head.isForcedWorkspace('?ws=false'), false);
assert.strictEqual(Head.isForcedWorkspace('?ws=no'), false);
assert.strictEqual(Head.isForcedWorkspace('?ws='), false);
assert.strictEqual(Head.isForcedWorkspace(''), false);
assert.strictEqual(Head.isForcedWorkspace('?code=abc'), false);
assert.strictEqual(Head.isStartPath, undefined, '/start helpers removed');
assert.strictEqual(Head.rewriteStartToRoot, undefined, '/start helpers removed');
assert.strictEqual(route({ search: '?ws=1' }), false, 'ws=1 signed out -> workspace not landing');
assert.strictEqual(route({ search: '?ws=1', storage: session }), false, 'ws=1 signed in -> workspace');
assert.strictEqual(route({ search: '?ws=1', hash: '#foo' }), false);
assert.strictEqual(route({ search: '?ws=true' }), false);
assert.strictEqual(route({ search: '?ws=0' }), true, 'ws=0 does not force workspace');
assert.strictEqual(route({ pathname: '/start' }), false, '/start is not a product path (non-root)');
assert.strictEqual(route({ pathname: '/start/' }), false, '/start/ is not a product path (non-root)');


// blank start shared plan: /?ws=1 (any auth) + signed-in / (LB-355); legal hash skips
assert.strictEqual(Head.BLANK_Z_HASH, BLANK.slice(1), 'blank token matches landing CTA');
assert.strictEqual(Head.shouldBlankStart({ search: '?ws=1', hash: '' }), true);
assert.strictEqual(Head.shouldBlankStart({ search: '?ws=1', hash: '#foo' }), true, 'illegal hash still blank-starts');
assert.strictEqual(Head.shouldBlankStart({ search: '?ws=true', hash: '' }), true);
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '', hash: '', storage: empty }), false, 'unsigned / does not blank-start (landing)');
assert.strictEqual(Head.shouldBlankStart({ search: '?ws=0', hash: '' }), false);
assert.strictEqual(Head.shouldBlankStart({ search: '?ws=1', hash: BOARD }), false, 'legal #b skips');
assert.strictEqual(Head.shouldBlankStart({ search: '?ws=1', hash: SHARE }), false, 'legal #s skips');
assert.strictEqual(Head.shouldBlankStart({ search: '?ws=1', hash: BLANK }), false, 'legal #z skips');
assert.strictEqual(Head.shouldBlankStart({ search: '?ws=1&code=abc', hash: '' }), false, 'OAuth return skips blank-start');
assert.strictEqual(Head.shouldBlankStart({ search: '?code=abc&ws=1', hash: '' }), false);

// LB-355: signed-in empty / → blank-start; legal hash still skips; ws=1 not overridden
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '', hash: '', storage: session }), true, 'signed-in / blank-starts');
assert.strictEqual(Head.shouldBlankStart({ pathname: '/index.html', search: '', hash: '', storage: session }), true);
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '', hash: '#foo', storage: session }), true, 'signed-in illegal hash blank-starts');
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '', hash: BOARD, storage: session }), false, 'signed-in legal #b skips');
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '', hash: SHARE, storage: session }), false, 'signed-in legal #s skips');
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '', hash: BLANK, storage: session }), false, 'signed-in legal #z skips');
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '?code=abc', hash: '', storage: session }), false, 'OAuth return skips even when signed-in');
assert.strictEqual(Head.shouldBlankStart({ pathname: '/landing/', search: '', hash: '', storage: session }), false, 'non-root skips');
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '?ws=1', hash: '', storage: empty }), true, 'ws=1 unsigned still blank-starts');
assert.strictEqual(Head.shouldBlankStart({ pathname: '/', search: '?ws=1', hash: '', storage: session }), true, 'ws=1 signed-in still blank-starts');

const planOut = Head.blankStartPlan({ search: '?ws=1', hash: '', storage: empty });
assert.ok(planOut);
assert.strictEqual(planOut.hash, Head.BLANK_Z_HASH);
assert.strictEqual(planOut.openDrawer, true, 'unsigned blank-start opens left drawer');

const planIn = Head.blankStartPlan({ search: '?ws=1', hash: '', storage: session });
assert.ok(planIn);
assert.strictEqual(planIn.hash, Head.BLANK_Z_HASH);
assert.strictEqual(planIn.openDrawer, false, 'signed-in blank-start keeps drawer closed');

const planRootIn = Head.blankStartPlan({ pathname: '/', search: '', hash: '', storage: session });
assert.ok(planRootIn);
assert.strictEqual(planRootIn.hash, Head.BLANK_Z_HASH);
assert.strictEqual(planRootIn.openDrawer, false, 'signed-in / blank-start keeps drawer closed');

assert.strictEqual(Head.blankStartPlan({ search: '?ws=1', hash: BOARD, storage: empty }), null);
assert.strictEqual(Head.blankStartPlan({ pathname: '/', search: '', hash: '', storage: empty }), null, 'unsigned / → landing not blank-start');
assert.strictEqual(Head.blankStartPlan({ search: '?ws=1&code=x', hash: '', storage: empty }), null);
assert.strictEqual(Head.blankStartPlan({ pathname: '/', search: '', hash: BOARD, storage: session }), null);

console.log('ok landing-route');
