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

function kidIds(board, boxId) {
  const box = Render.findNode(board, { kind: 'box', id: boxId });
  return (box.kids || []).map((kid) => kid.id || kid.text);
}

function topIds(board) {
  return (board.views || []).map((node) => node.id || node.text);
}

function pinOf(source, id, edge) {
  const re = new RegExp('pin ' + id + '\\.' + edge + ' to parent\\.' + edge + '(?: ([^\\n]+))?');
  const hit = String(source).match(re);
  return hit ? Number(hit[1] || 0) : null;
}

const nested = src(`
board Demo
box P "Parent"
  item A "alpha"
  box G type container "Group"
    item B "bravo"
    box C "Child"
  item D "delta"
P -> G title "to-shell"
P -> C title "to-child"
layout
  direction P row
`);

{
  const out = Render.deleteNode(nested, { kind: 'box', id: 'G' });
  const board = Render.parse(out.source);
  assert.deepStrictEqual(kidIds(board, 'P'), ['A', 'B', 'C', 'D']);
  assert.strictEqual(Render.findNode(board, { kind: 'box', id: 'G' }), null);
  assert.ok(Render.findNode(board, { kind: 'box', id: 'C' }));
  assert.ok(out.source.includes('P -> C title "to-child"'), out.source);
  assert.ok(!out.source.includes('P -> G'), out.source);
}

{
  const out = Render.deleteNode(nested, { kind: 'box', id: 'G', scope: 'shell' });
  const board = Render.parse(out.source);
  assert.deepStrictEqual(kidIds(board, 'P'), ['A', 'B', 'C', 'D']);
}

{
  const out = Render.deleteNode(nested, { kind: 'box', id: 'G', scope: 'tree' });
  const board = Render.parse(out.source);
  assert.deepStrictEqual(kidIds(board, 'P'), ['A', 'D']);
  assert.strictEqual(Render.findNode(board, { kind: 'box', id: 'G' }), null);
  assert.strictEqual(Render.findNode(board, { kind: 'box', id: 'C' }), null);
  assert.ok(!out.source.includes('P -> G'), out.source);
  assert.ok(!out.source.includes('P -> C'), out.source);
}

{
  const out = Render.deleteNode(nested, { kind: 'item', boxId: 'P', index: 0 });
  const board = Render.parse(out.source);
  assert.deepStrictEqual(kidIds(board, 'P'), ['G', 'D']);
}

const top = src(`
board Demo
box WRAP type layout
  box SCENE "Scene"
  item NOTE type note "read"
layout
  direction WRAP row
  pin WRAP.start to parent.start 100
  pin WRAP.top to parent.top 200
`);

{
  const out = Render.deleteNode(top, { kind: 'box', id: 'WRAP' });
  const board = Render.parse(out.source);
  assert.deepStrictEqual(topIds(board), ['SCENE', 'NOTE']);
  assert.strictEqual(Render.findNode(board, { kind: 'box', id: 'WRAP' }), null);
  assert.strictEqual(pinOf(out.source, 'SCENE', 'start'), 100);
  assert.strictEqual(pinOf(out.source, 'SCENE', 'top'), 200);
  assert.strictEqual(pinOf(out.source, 'NOTE', 'start'), 132);
  assert.strictEqual(pinOf(out.source, 'NOTE', 'top'), 200);
  assert.ok(!out.source.includes('box WRAP'), out.source);
}

{
  const out = Render.deleteNode(top, { kind: 'box', id: 'WRAP', scope: 'tree' });
  const board = Render.parse(out.source);
  assert.deepStrictEqual(topIds(board), []);
  assert.ok(!out.source.includes('box SCENE'), out.source);
}

console.log('ok delete-scope');
