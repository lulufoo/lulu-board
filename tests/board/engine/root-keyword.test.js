'use strict';
const assert = require('assert');
const View = require('../../../packages/boxes/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/boxes/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/boxes/engine/board-render.js');

{
  const board = Render.parse('boxes "Demo"\nbox A "Input"\n');
  assert.strictEqual(board.kind, 'boxes');
  assert.strictEqual(board.title, 'Demo');
  assert.ok(Render.serialize(board).startsWith('boxes "Demo"\n'));
}

{
  assert.throws(() => Render.parse('board "Legacy"\nbox A "Input"\n'), /boxes <title>/);
}

{
  assert.throws(() => Render.parse('box A "Input"\n'), /boxes <title>/);
  assert.throws(() => Render.parse('boxes "A"\nboxes "B"\n'), /only one boxes statement/);
  assert.throws(() => Render.parse('boxes "A"\nboard "B"\n'), /unknown statement 'board'/);
}

console.log('ok root-keyword');
