'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

{
  let threw = false;
  try {
    Render.parse('board Demo\nbox A "A"\nbox B "B"\nlayout\n  barrier BASE bottom of A, B\n');
  } catch (err) {
    threw = /barrier is not valid/.test(String(err.message));
  }
  assert.ok(threw, 'author barrier rejected');
}

{
  const board = Render.parse(
    'board Demo\nbox A "A"\nbox B "B"\nbox C "C"\nlayout\n  C below A, B\n'
  );
  assert.ok(!Render.serialize(board).includes('barrier'));
  const out = Layout.layout(board, new Map([
    ['A', { w: 80, h: 40 }],
    ['B', { w: 80, h: 40 }],
    ['C', { w: 80, h: 40 }],
  ]), { width: 800, adaptive: false });
  assert.ok((out.barriers || []).some((b) => (b.refs || []).includes('A') && (b.refs || []).includes('B')));
}

console.log('ok layout-no-barrier');
