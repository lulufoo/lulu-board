'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

const skillRoot = path.join(__dirname, '../../..');

function read(rel) {
  return fs.readFileSync(path.join(skillRoot, rel), 'utf8');
}

{
  const board = Render.parse('board Demo\nbox A "A"\n  item Flag type icon 502 "rejected"\n');
  const item = board.boxes[0].items[0];
  assert.strictEqual(item.type, 'icon');
  assert.strictEqual(item.icon, 502);
  assert.strictEqual(item.text, 'rejected');
  const out = Render.serialize(board);
  assert.ok(/item Flag type icon 502 "rejected"/.test(out), out);
  assert.ok(!/\btype\s+img\b/.test(out), out);
}

{
  let threw = false;
  try { Render.parse('board Demo\nbox A "A"\n  item type img 502\n'); }
  catch (err) { threw = /unknown item type 'img'/.test(String(err.message)); }
  assert.ok(threw, 'type img rejected');
}

{
  let threw = false;
  try { Render.parse('board Demo\nbox A "A"\n  item type image 502\n'); }
  catch (err) { threw = /unknown item type 'image'/.test(String(err.message)); }
  assert.ok(threw, 'type image rejected');
}

const vocab = read('skill/board/references/vocab.md');
assert.ok(/^## Icons$/m.test(vocab), 'vocab heading is Icons');
assert.ok(/\| `icon` \|/.test(vocab), 'vocab table has icon');
assert.ok(!/### img/.test(vocab), 'vocab has no img heading');
assert.ok(!/\| `img` \|/.test(vocab), 'vocab table has no img');

['skill/board/templates/board/onboarding.bmd', 'skill/board/templates/demo.bmd'].forEach((rel) => {
  const src = read(rel);
  assert.ok(/\btype\s+icon\b/.test(src), rel + ' uses type icon');
  assert.ok(!/\btype\s+img\b/.test(src), rel + ' has no type img');
  assert.ok(!/\btype\s+image\b/.test(src), rel + ' has no type image');
});

assert.ok(!fs.existsSync(path.join(skillRoot, 'packages/board/item/image.js')), 'image.js removed');
assert.ok(fs.existsSync(path.join(skillRoot, 'packages/board/item/icon.js')), 'icon.js present');

const iconJs = read('packages/board/item/icon.js');
assert.ok(/registerItem\('icon'/.test(iconJs), 'registers icon');
assert.ok(!/registerItem\('img'/.test(iconJs), 'does not register img');
assert.ok(!/registerItem\('image'/.test(iconJs), 'does not register image');
assert.ok(/board-item-icon/.test(iconJs), 'icon class name');
assert.ok(!/board-item-image/.test(iconJs), 'no image class');

const css = read('packages/drawer-app/css/03-diagram.css');
assert.ok(/\.board-item-icon\b/.test(css), 'css uses board-item-icon');
assert.ok(!/\.board-item-image\b/.test(css), 'css has no board-item-image');

const build = read('scripts/board-build/build.mjs');
assert.ok(/item\/icon\.js/.test(build), 'build lists icon.js');
assert.ok(!/item\/image\.js/.test(build), 'build does not list image.js');

const props = read('packages/drawer-app/js/02-board.js');
assert.ok(props.includes('"icon"'), 'props type list has icon');
assert.ok(!/"img"/.test(props), 'props type list has no img');
assert.ok(!/itemType === "image"/.test(props), 'props has no image alias');

console.log('ok item-type-icon');
