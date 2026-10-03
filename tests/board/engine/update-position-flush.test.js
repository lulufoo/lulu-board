'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

function parseLayout(source) {
  return Render.parse(source).layout;
}

{
  const src = 'board Demo\nbox A "A"\nbox B "B"\nlayout\n  flush A, B top\n';
  const out = Render.updatePosition(src, { kind: 'box', id: 'A' }, 24, 200);
  const layout = parseLayout(out);
  assert.deepStrictEqual(layout.aligns, []);
  assert.ok(out.includes('pin A.start to parent.start 24'), out);
  assert.ok(out.includes('pin A.top to parent.top 200'), out);
  assert.ok(!out.includes('flush'), out);
}

{
  const src = 'board Demo\nbox A "A"\nbox B "B"\nbox C "C"\nlayout\n  flush A, B, C top\n';
  const out = Render.updatePosition(src, { kind: 'box', id: 'A' }, 24, 200);
  const layout = parseLayout(out);
  assert.strictEqual(layout.aligns.length, 1);
  assert.deepStrictEqual(layout.aligns[0].ids, ['B', 'C']);
  assert.strictEqual(layout.aligns[0].edge, 'top');
  assert.ok(out.includes('flush B, C top'), out);
  assert.ok(!out.includes('pin B.'), out);
  assert.ok(!out.includes('pin C.'), out);
}

{
  const src = 'board Demo\nbox A "A"\nbox B "B"\nlayout\n  flush A, B top\n  flush A, B start\n';
  const out = Render.updatePosition(src, { kind: 'box', id: 'A' }, 80, 40);
  const layout = parseLayout(out);
  assert.deepStrictEqual(layout.aligns, []);
  assert.ok(!out.includes('flush'), out);
}

{
  const src = 'board Demo\nbox A "A"\nbox B "B"\nlayout\n  arrange B after A\n  flush A, B top\n';
  const out = Render.updatePosition(src, { kind: 'box', id: 'A' }, 24, 200);
  const layout = parseLayout(out);
  assert.deepStrictEqual(layout.aligns, []);
  assert.strictEqual(layout.places.length, 1);
  assert.strictEqual(layout.places[0].source, 'B');
  assert.strictEqual(layout.places[0].relation, 'after');
  assert.ok(out.includes('arrange B after A'), out);
}

{
  const src = 'board Demo\nbox A "A"\nbox B "B"\nlayout\n  flush A, B top\n';
  const out = Render.updatePosition(src, { kind: 'box', id: 'B' }, 200, 200);
  const layout = parseLayout(out);
  assert.deepStrictEqual(layout.aligns, []);
  assert.ok(out.includes('pin B.start to parent.start 200'), out);
  assert.ok(out.includes('pin B.top to parent.top 200'), out);
}

{
  const src = 'board Demo\nbox A "A"\nbox B "B"\nbox C "C"\nlayout\n  flush B, C top\n';
  const out = Render.updatePosition(src, { kind: 'box', id: 'A' }, 24, 200);
  const layout = parseLayout(out);
  assert.strictEqual(layout.aligns.length, 1);
  assert.deepStrictEqual(layout.aligns[0].ids, ['B', 'C']);
}

{
  const src = 'board Demo\nitem A "A"\nitem B "B"\nlayout\n  flush A, B top\n';
  const out = Render.updatePosition(src, { kind: 'item', id: 'A', boxId: null }, 24, 200);
  const layout = parseLayout(out);
  assert.deepStrictEqual(layout.aligns, []);
  assert.ok(out.includes('pin A.top to parent.top 200'), out);
}

console.log('ok update-position-flush');
