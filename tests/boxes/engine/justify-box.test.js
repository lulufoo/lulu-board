import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const Render = require('../../../packages/boxes/engine/render.js').default;

{
  const board = Render.parse(
    'boxes Demo\nbox A "A"\nbox B "B"\nlayout\n  justify A, B center\n'
  );
  assert.strictEqual(board.layout.boxes.A.align_y, 'center');
  assert.strictEqual(board.layout.boxes.B.align_y, 'center');
  const out = Render.serialize(board);
  assert.ok(out.includes('align_y A, B center'), out);
  assert.ok(!out.includes('justify'), out);
}

{
  const board = Render.parse('boxes Demo\nbox A "A"\nlayout\n  A justify stretch\n');
  assert.strictEqual(board.layout.boxes.A.align_y, 'stretch');
  assert.ok(Render.serialize(board).includes('align_y A stretch'));
}

{
  const board = Render.parse('boxes Demo\nbox A "A"\nlayout\n  A justify between\n');
  assert.strictEqual(board.layout.boxes.A.align_y, 'top');
  assert.ok(!Render.serialize(board).includes('between'));
}

{
  const board = Render.parse('boxes Demo\nbox A "A"\nlayout\n  A dir column\n  A align start\n');
  const out = Render.serialize(board);
  assert.ok(!out.includes('justify'), out);
  assert.ok(out.includes('align_x A left'), out);
}

{
  const row = Render.parse('boxes Demo\nbox A "A"\nlayout\n  A dir row\n  A align start\n  A justify stretch\n');
  assert.strictEqual(row.layout.boxes.A.align_y, 'top');
  assert.strictEqual(row.layout.boxes.A.align_x, 'stretch');
}

{
  const fs = require('fs');
  const path = require('path');
  const renderJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/engine/render.js'), 'utf8');
  const alignJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/engine/layout/box-align.js'), 'utf8');
  assert.ok(/function applyMainStretch/.test(renderJs), 'stretch grows kids');
  assert.ok(/function applyCrossStretch/.test(renderJs), 'cross stretch');
  assert.ok(/el.style.alignSelf = 'stretch'/.test(renderJs), 'cross stretch sets align-self');
  assert.ok(/flex = '1 0 auto'/.test(renderJs), 'stretch flex grow');
  assert.ok(/board-justify-stretch/.test(alignJs), 'stretch class');
  assert.ok(/isMainStretch/.test(alignJs), 'main-axis stretch');
  assert.ok(!/space-between/.test(alignJs), 'between is gone');
  assert.ok(/if \(isDiamondKid\(el\)\) return;/.test(renderJs), 'diamond skips grow');
}

console.log('ok justify-box');
