'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const View = require('../../packages/boxes/view/board-view.js');
global.BoardView = View;
const Layout = require('../../packages/boxes/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../packages/boxes/engine/board-render.js');
const Create = require('../../packages/drawer-app/js/09-create-kind-dialog.js');

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
];

assert.strictEqual(FILES.length, 13, 'thirteen built-in templates');
assert.deepStrictEqual(fs.readdirSync(dir).sort(), FILES.slice().sort(), 'templates dir is exactly the list');

Create.CREATE_KIND_ITEMS.filter((it) => it.ready).forEach((it) => {
  const ext = it.kind === 'welcome' || it.kind === 'boxes' ? '.bmd' : '.mmd';
  const name = it.kind + ext;
  assert.ok(FILES.includes(name), name + ' matches a ready kind');
  const text = fs.readFileSync(path.join(dir, name), 'utf8');
  assert.ok(String(text).trim(), name + ' is not empty');
  assert.doesNotMatch(text, /^%%\s*title\s/m, name + ' has no %% title');
});

{
  const welcome = fs.readFileSync(path.join(dir, 'welcome.bmd'), 'utf8');
  assert.match(welcome, /boxes "Lulu Board"/);
  assert.ok(!fs.existsSync(path.join(root, 'packages/drawer-app/onboarding.bmd')), 'root onboarding.bmd is gone');
}

{
  const board = fs.readFileSync(path.join(dir, 'boxes.bmd'), 'utf8');
  const demo = fs.readFileSync(path.join(root, 'skill/boxes/templates/demo.bmd'), 'utf8');
  assert.strictEqual(board, demo, 'boxes.bmd copies skill demo.bmd');
  assert.ok(!/^\s*meta\s+/.test(board), 'board template has no document meta');
  const parsed = Render.parse(board);
  assert.strictEqual(parsed.title, 'Demo');
  assert.ok(parsed.boxes.some((b) => b.id === 'IN'));
}

console.log('ok templates-files');
