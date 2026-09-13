'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

{
  const board = Render.parse(
    'board Demo\nbox A "A"\nbox B "B"\nlayout\n  flush A, B top\n'
  );
  assert.strictEqual(board.layout.aligns[0].edge, 'top');
  assert.deepStrictEqual(board.layout.aligns[0].ids, ['A', 'B']);
  const out = Render.serialize(board);
  assert.ok(out.includes('flush A, B top'), out);
}

{
  let threw = false;
  try {
    Render.parse('board Demo\nbox A "A"\nbox B "B"\nlayout\n  align A, B bottom\n');
  } catch (err) {
    threw = /align value must be start/.test(String(err.message));
  }
  assert.ok(threw, 'align rejects board edges');
}

{
  const board = Render.parse(
    'board Demo\nbox A "A"\nlayout\n  align A start\n'
  );
  assert.strictEqual(board.layout.boxes.A.align, 'start');
  const out = Render.serialize(board);
  assert.ok(out.includes('align A start'), out);
}

{
  const board = Render.parse(
    'board Demo\nbox A "A"\nbox B "B"\nlayout\n  flush A, B start\n'
  );
  assert.strictEqual(board.layout.aligns[0].edge, 'start');
  const out = Render.serialize(board);
  assert.ok(out.includes('flush A, B start'), out);
}

{
  // Legacy left / right still parse and serialize as start / end.
  const board = Render.parse(
    'board Demo\nbox A "A"\nbox B "B"\nlayout\n  flush A, B left\n  flush A, B right\n'
  );
  assert.strictEqual(board.layout.aligns[0].edge, 'start');
  assert.strictEqual(board.layout.aligns[1].edge, 'end');
  const out = Render.serialize(board);
  assert.ok(out.includes('flush A, B start'), out);
  assert.ok(out.includes('flush A, B end'), out);
  assert.ok(!/flush .* (left|right)/.test(out), out);
}

{
  let threw = false;
  try {
    Render.parse('board Demo\nbox A "A"\nbox B "B"\nlayout\n  flush A, B center\n');
  } catch (err) {
    threw = /flush edge must be start, end, top, or bottom/.test(String(err.message));
  }
  assert.ok(threw, 'flush rejects box-align values');
}

console.log('ok flush-keyword');
