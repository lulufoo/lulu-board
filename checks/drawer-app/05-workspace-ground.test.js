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
const ground = read('packages/drawer-app/src/core/workspace-ground.js');
const chrome = read(`${cssDir}/02-chrome.css`);

assert.match(ground, /import \{ resolveBackground \} from '..\/..\/..\/board-core\/style-token\.js'/, 'ground colors come from resolveBackground');
assert.match(ground, /resolveBackground\(id\)/, 'apply and paint ask resolveBackground for the document appearance');
assert.doesNotMatch(ground, /#dfe7ea|%23dfe7ea/, 'ground file holds no paper color of its own');

assert.match(boot, /import \{ applyGround \} from '\.\/workspace-ground\.js'/, 'early head imports the ground');
assert.match(boot, /import \{ applyChrome \} from '\.\/appearance-chrome\.js'/, 'early head imports dock chrome');
assert.ok(
  boot.indexOf('dataset.drawerMode = "diagram"') < boot.indexOf('applyGround(doc)'),
  'ground is applied right after drawerMode, before first paint'
);
assert.ok(
  boot.indexOf('applyGround(doc)') < boot.indexOf('applyChrome(doc)'),
  'dock chrome is applied with the ground, before first paint'
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
  'opening a document reapplies the document appearance ground',
);
assert.match(diagram, /appearanceFromStyleToken/, 'document ground reads appearance from the style token');
assert.match(diagram, /applyChrome\(document\.documentElement, appearance\)/, 'opening a document reapplies dock chrome');

console.log('ok workspace-ground check');
