'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

{
  const board = Render.parse('boxes "Demo"\nbox A "Input"\n');
  assert.strictEqual(board.kind, 'boxes');
  assert.strictEqual(board.title, 'Demo');
  assert.ok(Render.serialize(board).startsWith('boxes "Demo"\n'));
}

{
  const board = Render.parse('board "Legacy"\nbox A "Input"\n');
  assert.strictEqual(board.kind, 'boxes');
  assert.strictEqual(board.title, 'Legacy');
  assert.ok(Render.serialize(board).startsWith('boxes "Legacy"\n'));
}

{
  assert.throws(() => Render.parse('box A "Input"\n'), /boxes <title>/);
  assert.throws(() => Render.parse('boxes "A"\nboard "B"\n'), /only one boxes statement/);
}

console.log('ok root-keyword');
