'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

function parse(text) {
  return Render.parse(String(text).replace(/^\n/, ''));
}

{
  const board = parse(`
board Demo
box A "A"
box B "B"
box ROW type layout
item YOU type text "You"
layout
  direction A, B column
  direction ROW row
  align A start
  arrange B after A
  flush A, B top
  pin A.start to parent.start 32
`);
  assert.strictEqual(board.layout.boxes.A.direction, 'column');
  assert.strictEqual(board.layout.boxes.B.direction, 'column');
  assert.strictEqual(board.layout.boxes.ROW.direction, 'row');
  assert.strictEqual(board.layout.boxes.A.align, 'start');
  assert.strictEqual(board.layout.places[0].source, 'B');
  assert.strictEqual(board.layout.places[0].relation, 'after');
  assert.strictEqual(board.layout.aligns[0].edge, 'top');
  assert.strictEqual(board.layout.constraints[0].gap, 32);
  const out = Render.serialize(board);
  assert.ok(out.includes('direction ROW row'), out);
  assert.ok(out.includes('direction A, B column'), out);
  assert.ok(out.includes('align A start'), out);
  assert.ok(out.includes('arrange B after A'), out);
  assert.ok(out.includes('flush A, B top'), out);
  assert.ok(out.includes('pin A.start to parent.start 32'), out);
  assert.ok(!out.includes('dir '), out);
  assert.ok(!/\bB after A\b/.test(out.replace('arrange B after A', '')), out);
  assert.ok(!out.includes('gap 32'), out);
}

{
  const board = parse(`
board Demo
box A "A"
box B "B"
layout
  A dir column
  A align start
  B after A
  A.start to parent.start gap 24
  place B below A
  cons A.top to parent.top gap 8
`);
  const out = Render.serialize(board);
  assert.ok(out.includes('align A start'), out);
  assert.ok(out.includes('arrange B after A'), out);
  assert.ok(out.includes('arrange B below A'), out);
  assert.ok(out.includes('pin A.start to parent.start 24'), out);
  assert.ok(out.includes('pin A.top to parent.top 8'), out);
}

{
  const board = parse(`
board Demo
box A "A"
layout
  direction row gap 40 padding 28
`);
  assert.strictEqual(board.layout.board.direction, 'row');
  const out = Render.serialize(board);
  assert.ok(out.includes('direction row'), out);
  assert.ok(!out.includes('gap'), out);
}

{
  const board = parse(`
board Demo
box A "A"
box B "B"
layout
  pin A.end to B.end
`);
  assert.strictEqual(board.layout.constraints[0].gap, 0);
  assert.ok(Render.serialize(board).includes('pin A.end to B.end\n'), Render.serialize(board));
}

console.log('ok layout-keyword-first');
