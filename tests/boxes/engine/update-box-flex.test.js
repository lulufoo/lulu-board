import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const Render = require('../../../packages/boxes/engine/render.js').default;

const src = 'boxes Demo\nbox A "A"\n';

{
  const out = Render.updateAlignX(src, { kind: 'box', id: 'A' }, 'center');
  assert.ok(out.includes('align_x A center'), out);
  const board = Render.parse(out);
  assert.strictEqual(board.layout.boxes.A.align_x, 'center');
}

{
  const centered = Render.updateAlignX(src, { kind: 'box', id: 'A' }, 'center');
  const out = Render.updateAlignX(centered, { kind: 'box', id: 'A' }, 'stretch');
  assert.ok(out.includes('align_x A stretch'), out);
}

{
  const out = Render.updateAlignY(src, { kind: 'box', id: 'A' }, 'stretch');
  assert.ok(out.includes('align_y A stretch'), out);
  const board = Render.parse(out);
  assert.strictEqual(board.layout.boxes.A.align_y, 'stretch');
}

{
  const out = Render.updateAlignY(src, { kind: 'box', id: 'A' }, 'bottom');
  assert.ok(out.includes('align_y A bottom'), out);
}

{
  const out = Render.updateAlignX(src, { kind: 'title' }, 'right');
  assert.ok(out.includes('align_x right'), out);
  assert.strictEqual(Render.parse(out).layout.board.align_x, 'right');
}

{
  let threw = false;
  try { Render.updateAlignX(src, { kind: 'item', id: 'X' }, 'center'); }
  catch (err) { threw = /items do not have align_x/.test(String(err.message)); }
  assert.ok(threw, 'item cannot set align_x');
}

{
  const html = require('fs').readFileSync(require('path').join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
  assert.ok(/id="board-align-x-editor"/.test(html), 'align x control');
  assert.ok(/id="board-align-y-editor"/.test(html), 'align y control');
  assert.ok(/<option value="right">right<\/option>/.test(html), 'right align x');
  assert.ok(/<option value="bottom">bottom<\/option>/.test(html), 'bottom align y');
  assert.ok(!/<option value="between">between<\/option>/.test(html), 'no between');
  assert.ok(/id="board-align-x-tip"/.test(html), 'align x tip');
  assert.ok(/id="board-align-y-tip"/.test(html), 'align y tip');
  assert.ok(!/<option value="">default<\/option>/.test(html), 'no default option');
}

{
  const ui = require('fs').readFileSync(require('path').join(__dirname, '../../../packages/drawer-app/src/kinds/board.js'), 'utf8');
  assert.ok(/default · not in source/.test(ui), 'unset direction tip');
  assert.ok(/isTitle \? "row" : "column"/.test(ui), 'select still shows resolved default');
}

{
  const out = Render.updateDir(src, { kind: 'box', id: 'A' }, 'column');
  assert.ok(out.includes('direction A column'), out);
  const again = Render.serialize(Render.parse(src));
  assert.ok(!/direction A/.test(again), again);
  assert.ok(!/align_x A/.test(again), again);
  assert.ok(!/align_y A/.test(again), again);
  assert.ok(!/justify A/.test(again), again);
}

console.log('ok update-box-flex');
