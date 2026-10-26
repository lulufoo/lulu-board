import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-app/drawer.mjs'), 'utf8');
const web = fs.readFileSync(path.join(root, 'scripts/build-web/build.mjs'), 'utf8');

assert.match(html, /pele\.global\.js/, 'index loads Pele runtime');
assert.ok(!/mermaid(\.min)?\.js/.test(html), 'index does not load Mermaid.js');
assert.match(build, /pele\.global\.js/, 'drawer-app build copies Pele');
assert.match(web, /pele\.global\.js/, 'web build requires Pele');
const pele = fs.readFileSync(path.join(root, 'third_party/pele/pele.global.js'), 'utf8');
const header = pele.split('\n')[0];
assert.match(header, /Pele 1\.7\.0/, 'Pele file header has the pin');
assert.strictEqual(fs.readFileSync(path.join(root, 'third_party/pele/VERSION'), 'utf8').trim(), '1.7.0');
assert.ok(!fs.existsSync(path.join(root, 'packages/pele-vendor')), 'old pele-vendor dir is gone');
assert.ok(!fs.existsSync(path.join(root, 'packages/drawer-app/vendor')), 'old drawer vendor dir is gone');

console.log('ok pele-vendor');
