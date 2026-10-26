import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const Layout = require('../../../packages/boxes/engine/layout').default;
const Render = require('../../../packages/boxes/engine/render.js').default;

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
