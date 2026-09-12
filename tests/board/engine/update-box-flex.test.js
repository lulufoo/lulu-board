'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

const src = 'board Demo\nbox A "A"\n';

{
  const out = Render.updateAlign(src, { kind: 'box', id: 'A' }, 'center');
  assert.ok(out.includes('align A center'), out);
  const board = Render.parse(out);
  assert.strictEqual(board.layout.boxes.A.align, 'center');
}

{
  const centered = Render.updateAlign(src, { kind: 'box', id: 'A' }, 'center');
  const out = Render.updateAlign(centered, { kind: 'box', id: 'A' }, 'stretch');
  assert.ok(out.includes('align A stretch'), out);
}

{
  const out = Render.updateJustify(src, { kind: 'box', id: 'A' }, 'stretch');
  assert.ok(out.includes('justify A stretch'), out);
  const board = Render.parse(out);
  assert.strictEqual(board.layout.boxes.A.justify, 'stretch');
}

{
  const stretched = Render.updateJustify(src, { kind: 'box', id: 'A' }, 'stretch');
  const out = Render.updateJustify(stretched, { kind: 'box', id: 'A' }, 'start');
  assert.ok(out.includes('justify A start'), out);
}

{
  let threw = false;
  try { Render.updateAlign(src, { kind: 'title' }, 'center'); }
  catch (err) { threw = /only a box can set align/.test(String(err.message)); }
  assert.ok(threw, 'title cannot set box align');
}

{
  let threw = false;
  try { Render.updateJustify(src, { kind: 'item', id: 'X' }, 'center'); }
  catch (err) { threw = /items do not have justify/.test(String(err.message)); }
  assert.ok(threw, 'item cannot set justify');
}

{
  const html = require('fs').readFileSync(require('path').join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
  assert.ok(/id="boardAlignEditor"/.test(html), 'align control');
  assert.ok(/id="boardJustifyEditor"/.test(html), 'justify control');
  assert.ok(/id="boardDirTip"/.test(html), 'direction tip');
  assert.ok(/id="boardAlignTip"/.test(html), 'align tip');
  assert.ok(/id="boardJustifyTip"/.test(html), 'justify tip');
  assert.ok(!/<option value="">default<\/option>/.test(html), 'no default option');
}

{
  const ui = require('fs').readFileSync(require('path').join(__dirname, '../../../packages/drawer-app/js/02-board.js'), 'utf8');
  assert.ok(/default · not in source/.test(ui), 'unset direction tip');
  assert.ok(/isTitle \? "row" : "column"/.test(ui), 'select still shows resolved default');
}

{
  const out = Render.updateDir(src, { kind: 'box', id: 'A' }, 'column');
  assert.ok(out.includes('direction A column'), out);
  const again = Render.serialize(Render.parse(src));
  assert.ok(!/direction A/.test(again), again);
  assert.ok(!/align A/.test(again), again);
  assert.ok(!/justify A/.test(again), again);
}

console.log('ok update-box-flex');
