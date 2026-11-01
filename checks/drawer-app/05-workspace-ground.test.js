import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const cssDir = 'packages/drawer-app/css';

const boot = read('packages/drawer-app/src/core/early-head-boot.js');
const diagram = read('packages/drawer-app/src/kinds/diagram.js');
const exportPng = read('packages/drawer-app/src/export/export-png.js');
const chrome = read(`${cssDir}/02-chrome.css`);

assert.match(boot, /import \{ applyGround \} from '\.\/workspace-ground\.js'/, 'early head imports the ground');
assert.ok(
  boot.indexOf('dataset.drawerMode = "diagram"') < boot.indexOf('applyGround(doc)'),
  'ground is applied right after drawerMode, before first paint'
);

const shell = chrome.match(/\n\.canvas-shell \{[^}]*\}/);
assert.ok(shell, '.canvas-shell base rule exists in 02-chrome.css');
assert.match(shell[0], /background-color: var\(--ground-bg\);/, 'canvas reads the ground color');
assert.match(shell[0], /background-image: var\(--ground-image\);/, 'canvas reads the ground image');
assert.match(shell[0], /background-size: var\(--ground-size\);/, 'canvas reads the ground size');
assert.doesNotMatch(shell[0], /#[0-9a-f]{3,8}\b|rgba?\(|gradient|\bpx\b/i, 'canvas rule carries no second copy of the numbers');

const cssFiles = fs.readdirSync(path.join(root, cssDir)).filter((name) => name.endsWith('.css'));
for (const name of cssFiles) {
  const css = read(`${cssDir}/${name}`);
  assert.doesNotMatch(css, /#dfe7ea|%23dfe7ea|#f8fafc/i, `${name} holds no ground color`);
  assert.doesNotMatch(css, /--dot\b/, `${name} has no --dot token`);
}
assert.doesNotMatch(exportPng, /#dfe7ea|#f8fafc|paintExportGrid/i, 'export holds no ground numbers of its own');
assert.match(diagram, /import \{ applyGround \} from '\.\.\/core\/workspace-ground\.js'/, 'diagram imports the ground');
assert.match(
  diagram.slice(diagram.indexOf('function finishCanvasView')),
  /applyDocumentGround\(\)/,
  'opening a document reapplies the locked paper ground',
);

console.log('ok workspace-ground check');
