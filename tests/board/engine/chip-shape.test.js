'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

function src(text) {
  return String(text).replace(/^\n/, '');
}

{
  const board = Render.parse(src(`
board Demo
box AGENT "Agent"
box UA type container "浏览器"
  box MC "ModelContext"
    item "map"
  box GATE type diamond 512 "调用闸门"
    item ITEM1 "Schema 校验"
    item "用户同意"
AGENT -> GATE
layout
  UA dir column
  GATE dir column
`));
  const ua = board.boxes.find((b) => b.id === 'UA');
  assert.ok(ua, 'UA box');
  const kids = ua.kids || [];
  assert.strictEqual(kids[0].id, 'MC');
  assert.strictEqual(kids[1].type, 'chip');
  assert.strictEqual(kids[1].shape, 'diamond');
  assert.strictEqual(kids[1].id, 'GATE');
  assert.strictEqual(kids[1].text, '调用闸门');
  assert.ok(kids.some((k) => k.text === 'Schema 校验'));
  assert.ok(!ua.boxes.some((b) => b.id === 'GATE'));
  const out = Render.serialize(board);
  assert.ok(out.includes('item GATE shape diamond "调用闸门"'), out);
  assert.ok(!out.includes('type diamond'), out);
  assert.ok(!out.includes('GATE dir'), out);
}

{
  const board = Render.parse('board Demo\nitem X shape diamond "Executor Interface"\n');
  assert.strictEqual(board.views[0].shape, 'diamond');
  assert.strictEqual(Render.serialize(board).includes('item X shape diamond "Executor Interface"'), true);
}

{
  let threw = false;
  try { Render.parse('board Demo\nitem type text shape diamond "no"\n'); }
  catch (err) { threw = /shape is only valid on chip/.test(String(err.message)); }
  assert.ok(threw, 'text+shape rejected');
}

{
  const source = src(`
board Demo
box UA type container "UA"
  box MC "MC"
  item GATE shape diamond "闸门"
`);
  const sel = { kind: 'item', id: 'GATE', boxId: 'UA', index: 0 };
  const rect = Render.updateShape(source, sel, 'rect');
  assert.ok(rect.includes('item GATE "闸门"'), rect);
  assert.ok(!rect.includes('shape diamond'), rect);
  const diamond = Render.updateShape(rect, sel, 'diamond');
  assert.ok(diamond.includes('item GATE shape diamond "闸门"'), diamond);
}

console.log('ok chip-shape');
