'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

{
  const board = Render.parse('board Demo\nbox A "Input"\n');
  assert.strictEqual(board.boxes[0].type, 'card');
  assert.strictEqual(board.boxes[0].kind, 'card');
  const out = Render.serialize(board);
  assert.ok(out.includes('box A "Input"'), out);
  assert.ok(!out.includes('type card'), out);
  assert.ok(!out.includes('type rect'), out);
}

{
  const board = Render.parse('board Demo\nbox A type card "Input"\n');
  assert.strictEqual(board.boxes[0].type, 'card');
  assert.ok(!Render.serialize(board).includes('type card'));
}

{
  const board = Render.parse('board Demo\nbox A type container "Group"\n');
  assert.strictEqual(board.boxes[0].type, 'container');
  assert.ok(Render.serialize(board).includes('type container'));
}

{
  let threw = false;
  try { Render.parse('board Demo\nbox A type rect "Input"\n'); }
  catch (err) { threw = /unknown box type 'rect'/.test(String(err.message)); }
  assert.ok(threw, 'type rect rejected');
}

{
  let threw = false;
  try { Render.parse('board Demo\nbox A type document "Doc"\n'); }
  catch (err) { threw = /unknown box type 'document'/.test(String(err.message)); }
  assert.ok(threw, 'legacy document rejected');
}

console.log('ok box-type-card');
