import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Layout = require('../../../packages/boxes/engine/layout').default;
const Render = require('../../../packages/boxes/engine/render.js').default;

const skillRoot = path.join(__dirname, '../../..');

function read(rel) {
  return fs.readFileSync(path.join(skillRoot, rel), 'utf8');
}

{
  const board = Render.parse('boxes Demo\nbox A "A"\n  item Flag type icon 502 "rejected"\n');
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
  try { Render.parse('boxes Demo\nbox A "A"\n  item type img 502\n'); }
  catch (err) { threw = /unknown item type 'img'/.test(String(err.message)); }
  assert.ok(threw, 'type img rejected');
}

{
  let threw = false;
  try { Render.parse('boxes Demo\nbox A "A"\n  item type image 502\n'); }
  catch (err) { threw = /unknown item type 'image'/.test(String(err.message)); }
  assert.ok(threw, 'type image rejected');
}

const vocab = read('packages/boxes/skill-assets/vocab.md');
assert.ok(/^## Icons$/m.test(vocab), 'vocab heading is Icons');
assert.ok(/\| `icon` \|/.test(vocab), 'vocab table has icon');
assert.ok(!/### img/.test(vocab), 'vocab has no img heading');
assert.ok(!/\| `img` \|/.test(vocab), 'vocab table has no img');

['skill/boxes/templates/demo.bmd'].forEach((rel) => {
  const src = read(rel);
  assert.ok(/\btype\s+icon\b/.test(src), rel + ' uses type icon');
  assert.ok(!/\btype\s+img\b/.test(src), rel + ' has no type img');
  assert.ok(!/\btype\s+image\b/.test(src), rel + ' has no type image');
});

assert.ok(!fs.existsSync(path.join(skillRoot, 'packages/boxes/item/image.js')), 'image.js removed');
assert.ok(fs.existsSync(path.join(skillRoot, 'packages/boxes/item/icon.js')), 'icon.js present');

const iconJs = read('packages/boxes/item/icon.js');
assert.ok(/registerItem\('icon'/.test(iconJs), 'registers icon');
assert.ok(!/registerItem\('img'/.test(iconJs), 'does not register img');
assert.ok(!/registerItem\('image'/.test(iconJs), 'does not register image');
assert.ok(/board-item-icon/.test(iconJs), 'icon class name');
assert.ok(!/board-item-image/.test(iconJs), 'no image class');

const css = read('packages/drawer-app/css/03-diagram.css');
assert.ok(/\.board-item-icon\b/.test(css), 'css uses board-item-icon');
assert.ok(!/\.board-item-image\b/.test(css), 'css has no board-item-image');

const build = read('scripts/build-app/boxes.mjs');
assert.ok(/item\/icon\.js/.test(read('packages/boxes/model.js')), 'model registers icon.js');
assert.ok(!/item\/image\.js/.test(build), 'build does not list image.js');

const props = read('packages/drawer-app/src/kinds/board.js');
assert.ok(props.includes('"icon"'), 'props type list has icon');
assert.ok(!/"img"/.test(props), 'props type list has no img');
assert.ok(!/itemType === "image"/.test(props), 'props has no image alias');

console.log('ok item-type-icon');
