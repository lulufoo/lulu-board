'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const sync = read('packages/drawer-app/js/06-cloud-sync.js');
const landingJs = read('packages/drawer-app/landing/landing.js');
const landingHtml = read('packages/drawer-app/landing/index.html');

// the landing page only writes known intents
const intents = new Set((landingHtml.match(/data-open-sign-in="[^"]*"/g) || []).map((m) => m.split('"')[1]));
assert.deepStrictEqual([...intents], ['menu'], 'only the footer Sign in writes a sign-in flag');
assert.match(landingJs, /lulu-board:open-sign-in/, 'landing writes the one-shot flag');

// the workspace reads it once, only on the signed-out branch
assert.match(sync, /if \(cloudSession\) void cloudRefreshGroups\(\);\s*else cloudOpenSignInFromLanding\(\);/, 'only when there is no session');

const start = sync.indexOf('function cloudOpenSignInFromLanding()');
const end = sync.indexOf('function cloudInit()');
assert.ok(start > 0 && end > start, 'handoff function is present');

function run(flag, button) {
  const store = flag ? { 'lulu-board:open-sign-in': flag } : {};
  const calls = { signIn: [], clicks: 0 };
  const ctx = {
    sessionStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      removeItem: (k) => { delete store[k]; },
    },
    document: { getElementById: () => button || null },
    cloudSignIn: (provider) => { calls.signIn.push(provider); return Promise.resolve(); },
  };
  vm.runInNewContext(sync.slice(start, end) + '\ncloudOpenSignInFromLanding();', ctx);
  return { store, calls };
}
const menuButton = (state) => Object.assign({ hidden: false, disabled: false }, state);

let result = run('github', menuButton());
assert.deepStrictEqual(result.calls.signIn, ['github'], 'github intent starts GitHub sign-in');
assert.deepStrictEqual(result.store, {}, 'flag is cleared after one read');

let clicks = 0;
result = run('menu', Object.assign(menuButton(), { click: () => { clicks += 1; } }));
assert.strictEqual(clicks, 1, 'menu intent opens the sign-in menu');
assert.deepStrictEqual(result.calls.signIn, []);
assert.deepStrictEqual(result.store, {});

result = run('', Object.assign(menuButton(), { click: () => { clicks += 1; } }));
assert.strictEqual(clicks, 1, 'no flag does nothing');
assert.deepStrictEqual(result.calls.signIn, []);

clicks = 0;
run('menu', Object.assign(menuButton({ hidden: true }), { click: () => { clicks += 1; } }));
run('menu', Object.assign(menuButton({ disabled: true }), { click: () => { clicks += 1; } }));
assert.strictEqual(clicks, 0, 'a hidden or disabled sign-in button is not clicked');

console.log('ok landing-sign-in');
