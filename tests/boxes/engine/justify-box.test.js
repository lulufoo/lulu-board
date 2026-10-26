import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const Layout = require('../../../packages/boxes/engine/layout').default;
const Render = require('../../../packages/boxes/engine/render.js').default;

{
  const board = Render.parse(
    'boxes Demo\nbox A "A"\nbox B "B"\nlayout\n  justify A, B center\n'
  );
  assert.strictEqual(board.layout.boxes.A.justify, 'center');
  assert.strictEqual(board.layout.boxes.B.justify, 'center');
  const out = Render.serialize(board);
  assert.ok(out.includes('justify A, B center'), out);
}

{
  const board = Render.parse('boxes Demo\nbox A "A"\nlayout\n  A justify stretch\n');
  assert.strictEqual(board.layout.boxes.A.justify, 'stretch');
  assert.ok(Render.serialize(board).includes('justify A stretch'));
}

{
  const board = Render.parse('boxes Demo\nbox A "A"\nlayout\n  A justify between\n');
  assert.strictEqual(board.layout.boxes.A.justify, 'between');
  assert.ok(Render.serialize(board).includes('justify A between'));
}

{
  const board = Render.parse('boxes Demo\nbox A "A"\nlayout\n  A dir column\n  A align start\n');
  const out = Render.serialize(board);
  assert.ok(!out.includes('justify'), out);
  assert.ok(out.includes('align A start'), out);
}

{
  const fs = require('fs');
  const path = require('path');
  const renderJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/engine/render.js'), 'utf8');
  assert.ok(/function applyMainStretch/.test(renderJs), 'stretch grows kids');
  assert.ok(/flex = '1 0 auto'/.test(renderJs), 'stretch flex grow');
  assert.ok(/board-justify-stretch/.test(renderJs), 'stretch class');
  assert.ok(/props\.justify === 'between' \? 'space-between' : 'flex-start'/.test(renderJs), 'between uses flex spacing');
  assert.ok(/if \(isDiamondKid\(el\)\) return;/.test(renderJs), 'diamond skips grow');
}

console.log('ok justify-box');
