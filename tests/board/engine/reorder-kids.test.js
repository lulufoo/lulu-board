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

const mixed = src(`
board Demo
box P "Parent"
  item A "alpha"
  box B "Bravo"
  item C "charlie"
layout
  direction P row
`);

function kidIds(board, boxId) {
  const box = Render.findNode(board, { kind: 'box', id: boxId });
  return (box.kids || []).map((kid) => kid.id || kid.text);
}

{
  const info = Render.reorderInfo(mixed, { kind: 'item', id: 'C', boxId: 'P', index: 1 });
  assert.ok(info, 'nested item has reorder info');
  assert.strictEqual(info.parentId, 'P');
  assert.strictEqual(info.index, 2);
  assert.strictEqual(info.count, 3);
  assert.strictEqual(info.direction, 'row');
}

{
  const info = Render.reorderInfo(mixed, { kind: 'box', id: 'P' });
  assert.strictEqual(info, null, 'top-level box cannot reorder');
}

{
  let threw = false;
  try { Render.reorderNode(mixed, { kind: 'box', id: 'P' }, 0); }
  catch (err) { threw = /only a nested Board node/.test(String(err.message)); }
  assert.ok(threw, 'top-level reorder rejected');
}

{
  const moved = Render.reorderNode(mixed, { kind: 'item', id: 'C', boxId: 'P', index: 1 }, 0);
  const board = Render.parse(moved.source);
  assert.deepStrictEqual(kidIds(board, 'P'), ['C', 'A', 'B']);
  assert.ok(moved.source.includes('item C "charlie"'), moved.source);
  assert.strictEqual(moved.selection.kind, 'item');
  assert.strictEqual(moved.selection.boxId, 'P');
  assert.strictEqual(moved.selection.index, 0);
  assert.strictEqual(moved.selection.key, 'item:P:0');
}

{
  const moved = Render.reorderNode(mixed, { kind: 'box', key: 'box:B', id: 'B' }, 0);
  assert.deepStrictEqual(kidIds(Render.parse(moved.source), 'P'), ['B', 'A', 'C']);
  assert.strictEqual(moved.selection.id, 'B');
}

{
  const same = Render.reorderNode(mixed, { kind: 'item', id: 'A', boxId: 'P', index: 0 }, 0);
  assert.strictEqual(same.source, mixed);
}

{
  const clamped = Render.reorderNode(mixed, { kind: 'item', id: 'A', boxId: 'P', index: 0 }, 99);
  assert.deepStrictEqual(kidIds(Render.parse(clamped.source), 'P'), ['B', 'C', 'A']);
}

{
  const column = src(`
board Demo
box P "Parent"
  item A "alpha"
  item B "beta"
`);
  const info = Render.reorderInfo(column, { kind: 'item', id: 'B', boxId: 'P', index: 1 });
  assert.strictEqual(info.direction, 'column');
  const moved = Render.reorderNode(column, { kind: 'item', id: 'B', boxId: 'P', index: 1 }, 0);
  assert.deepStrictEqual(kidIds(Render.parse(moved.source), 'P'), ['B', 'A']);
}

{
  const map = Render.reorderFinalIndex;
  assert.strictEqual(map(0, 0), 0, 'before self is no-op');
  assert.strictEqual(map(0, 1), 0, 'after self / before next is no-op');
  assert.strictEqual(map(0, 2), 1, 'before third becomes index 1');
  assert.strictEqual(map(0, 3), 2, 'after last becomes last');
  assert.strictEqual(map(1, 0), 0, 'before first');
  assert.strictEqual(map(1, 1), 1, 'before self is no-op');
  assert.strictEqual(map(1, 2), 1, 'after self is no-op');
  assert.strictEqual(map(1, 3), 2, 'after last');
  assert.strictEqual(map(2, 0), 0);
  assert.strictEqual(map(2, 2), 2);
  assert.strictEqual(map(2, 3), 2);
}

console.log('ok reorder-kids');
