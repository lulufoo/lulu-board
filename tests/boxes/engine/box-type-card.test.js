import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const Layout = require('../../../packages/boxes/engine/layout').default;
const Render = require('../../../packages/boxes/engine/render.js').default;

{
  const board = Render.parse('boxes Demo\nbox A "Input"\n');
  assert.strictEqual(board.boxes[0].type, 'card');
  assert.strictEqual(board.boxes[0].kind, 'card');
  const out = Render.serialize(board);
  assert.ok(out.includes('box A "Input"'), out);
  assert.ok(!out.includes('type card'), out);
  assert.ok(!out.includes('type rect'), out);
}

{
  const board = Render.parse('boxes Demo\nbox A type card "Input"\n');
  assert.strictEqual(board.boxes[0].type, 'card');
  assert.ok(!Render.serialize(board).includes('type card'));
}

{
  const board = Render.parse('boxes Demo\nbox A type container "Group"\n');
  assert.strictEqual(board.boxes[0].type, 'container');
  assert.ok(Render.serialize(board).includes('type container'));
}

{
  let threw = false;
  try { Render.parse('boxes Demo\nbox A type rect "Input"\n'); }
  catch (err) { threw = /unknown box type 'rect'/.test(String(err.message)); }
  assert.ok(threw, 'type rect rejected');
}

{
  let threw = false;
  try { Render.parse('boxes Demo\nbox A type document "Doc"\n'); }
  catch (err) { threw = /unknown box type 'document'/.test(String(err.message)); }
  assert.ok(threw, 'legacy document rejected');
}

console.log('ok box-type-card');
