import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Layout = require('../../packages/boxes/engine/layout').default;
const Render = require('../../packages/boxes/engine/render.js').default;
const Create = require('../../packages/drawer-app/src/chrome/create-kind-dialog.js');

const root = path.join(__dirname, '../..');
const dir = path.join(root, 'packages/drawer-app/templates');

const FILES = [
  'welcome.bmd',
  'boxes.bmd',
  'flowchart.mmd',
  'mindmap.mmd',
  'sequenceDiagram.mmd',
  'classDiagram.mmd',
  'stateDiagram.mmd',
  'erDiagram.mmd',
  'requirement.mmd',
  'C4Context.mmd',
  'usecase-beta.mmd',
  'eventmodeling.mmd',
  'railroad-beta.mmd',
  'sketch.skt',
];

assert.strictEqual(FILES.length, 14, 'fourteen built-in templates');
assert.deepStrictEqual(fs.readdirSync(dir).sort(), FILES.slice().sort(), 'templates dir is exactly the list');

Create.CREATE_KIND_ITEMS.filter((it) => it.ready).forEach((it) => {
  const ext = it.kind === 'welcome' || it.kind === 'boxes' ? '.bmd' : (it.kind === 'sketch' ? '.skt' : '.mmd');
  const name = it.kind + ext;
  assert.ok(FILES.includes(name), name + ' matches a ready kind');
  const text = fs.readFileSync(path.join(dir, name), 'utf8');
  assert.ok(String(text).trim(), name + ' is not empty');
  assert.doesNotMatch(text, /^%%\s*title\s/m, name + ' has no %% title');
});

{
  const welcome = fs.readFileSync(path.join(dir, 'welcome.bmd'), 'utf8');
  assert.match(welcome, /^sketch "What each one is for\."/);
  assert.ok(!fs.existsSync(path.join(root, 'packages/drawer-app/onboarding.bmd')), 'root onboarding.bmd is gone');
}

{
  const board = fs.readFileSync(path.join(dir, 'boxes.bmd'), 'utf8');
  const demo = fs.readFileSync(path.join(root, 'skills/boxes/templates/demo.bmd'), 'utf8');
  assert.strictEqual(board, demo, 'boxes.bmd copies skill demo.bmd');
  assert.ok(!/^\s*meta\s+/.test(board), 'board template has no document meta');
  const parsed = Render.parse(board);
  assert.strictEqual(parsed.title, 'Boxes');
  assert.ok(parsed.boxes.some((b) => b.id === 'CARD'));
}

console.log('ok templates-files');
