'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

{
  const board = Render.parse(
    'board Demo\nbox A "A"\nbox B "B"\nlayout\n  justify A, B center\n'
  );
  assert.strictEqual(board.layout.boxes.A.justify, 'center');
  assert.strictEqual(board.layout.boxes.B.justify, 'center');
  const out = Render.serialize(board);
  assert.ok(out.includes('justify A, B center'), out);
}

{
  const board = Render.parse('board Demo\nbox A "A"\nlayout\n  A justify stretch\n');
  assert.strictEqual(board.layout.boxes.A.justify, 'stretch');
  assert.ok(Render.serialize(board).includes('justify A stretch'));
}

{
  const board = Render.parse('board Demo\nbox A "A"\nlayout\n  A dir column\n  A align start\n');
  const out = Render.serialize(board);
  assert.ok(!out.includes('justify'), out);
  assert.ok(out.includes('align A start'), out);
}

{
  const fs = require('fs');
  const path = require('path');
  const renderJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/engine/board-render.js'), 'utf8');
  assert.ok(/function applyMainStretch/.test(renderJs), 'stretch grows kids');
  assert.ok(/flex = '1 0 auto'/.test(renderJs), 'stretch flex grow');
  assert.ok(/board-justify-stretch/.test(renderJs), 'stretch class');
  assert.ok(/justifyContent = props\.justify === 'center' \? 'center' : 'flex-start'/.test(renderJs), 'stretch is not justify-content');
  assert.ok(/if \(isDiamondKid\(el\)\) return;/.test(renderJs), 'diamond skips grow');
}

console.log('ok justify-box');
