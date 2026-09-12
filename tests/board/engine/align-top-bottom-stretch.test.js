'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

{
  const board = Render.parse(
    'board Demo\nbox A "A"\nbox B "B"\nlayout\n  arrange B after A\n  flush A, B top\n'
  );
  const out = Layout.layout(board, new Map([
    ['A', { w: 100, h: 80 }],
    ['B', { w: 100, h: 140 }],
  ]), { width: 800, adaptive: false });
  assert.strictEqual(out.frames.get('A').h, 80);
  assert.strictEqual(out.frames.get('B').h, 140);
}

{
  const board = Render.parse(
    'board Demo\nbox A "A"\nbox B "B"\nlayout\n  arrange B after A\n  flush A, B top\n  flush A, B bottom\n'
  );
  const out = Layout.layout(board, new Map([
    ['A', { w: 100, h: 80 }],
    ['B', { w: 100, h: 140 }],
  ]), { width: 800, adaptive: false });
  const a = out.frames.get('A');
  const b = out.frames.get('B');
  assert.strictEqual(a.h, 140);
  assert.strictEqual(b.h, 140);
  assert.strictEqual(a.y, b.y);
  assert.strictEqual(a.y + a.h, b.y + b.h);
}

console.log('ok align-top-bottom-stretch');
