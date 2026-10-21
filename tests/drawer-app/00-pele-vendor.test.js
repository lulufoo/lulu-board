'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
const web = fs.readFileSync(path.join(root, 'scripts/web-build/build.mjs'), 'utf8');

assert.match(html, /pele\.global\.js/, 'index loads Pele runtime');
assert.ok(!/mermaid(\.min)?\.js/.test(html), 'index does not load Mermaid.js');
assert.match(build, /pele\.global\.js/, 'drawer-app build copies Pele');
assert.match(web, /pele\.global\.js/, 'web build requires Pele');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/vendor/pele.global.js')), 'Pele runtime is vendored');
assert.ok(fs.existsSync(path.join(root, 'packages/pele-vendor/PELE_PIN')), 'Pele pin is present');
assert.strictEqual(fs.readFileSync(path.join(root, 'packages/pele-vendor/PELE_PIN'), 'utf8').trim(), '1.7.0');

console.log('ok pele-vendor');
