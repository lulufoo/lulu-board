'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const js = read('packages/drawer-app/js/09-shell-drawer.js');
const sync = read('packages/drawer-app/js/06-cloud-sync.js');
const appBuild = read('scripts/drawer-app-build/build.mjs');

assert.match(appBuild, /09-shell-drawer\.js/, 'drawer script is built');
assert.doesNotMatch(appBuild, /09-shell-prototype/, 'the prototype file name is gone');
assert.match(html, /id="shellMineList"/, 'Mine is a data container, not mock rows');
assert.match(html, /id="shellShared"[^>]*hidden/, 'Shared stays hidden until it is wired');
assert.match(html, /id="shellAccountName"[\s\S]*id="btnShellSignOut"/, 'account row has name and sign out');
assert.doesNotMatch(html, /Payments retry flow<\/b><span>4 boards/, 'no mock Mine rows in the markup');
assert.match(sync, /shellPaintAccount\(profile\)/, 'account row follows the session');
assert.match(sync, /shellRenderMine\(groups\)/, 'Mine follows the cloud group list');

const grab = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const { shellWhen } = new Function(grab(js, 'function shellWhen', '// Local preview has no cloud') + '\nreturn { shellWhen };')();
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
assert.strictEqual(shellWhen(day(0)), 'today');
assert.strictEqual(shellWhen(day(1)), 'yesterday');
assert.match(shellWhen(day(3)), /^[A-Z][a-z]+day$/, 'within a week: weekday name');
assert.match(shellWhen(day(30)), /^[A-Z][a-z]{2} \d{1,2}$/, 'older: short date');
assert.strictEqual(shellWhen(''), '');
assert.strictEqual(shellWhen('nope'), '');
console.log('ok 09-shell-drawer');
