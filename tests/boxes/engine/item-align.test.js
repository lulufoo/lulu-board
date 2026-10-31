import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const Render = require('../../../packages/boxes/engine/render.js').default;
const Align = require('../../../packages/boxes/themes/item-align.js');

assert.strictEqual(Align.defaultForType('chip'), 'center');
assert.strictEqual(Align.defaultForType('text'), 'top-left');
assert.strictEqual(Align.defaultForType('note'), 'top-left');
assert.strictEqual(Align.defaultForType('icon'), 'left');
assert.strictEqual(Align.authored('center'), 'center');
assert.strictEqual(Align.authored('nope'), null);
assert.strictEqual(Align.resolve(null, 'chip'), 'center');
assert.strictEqual(Align.resolve('right', 'chip'), 'right');

{
  const src = 'boxes Demo\nitem A "x"\nitem T type text "hi"\nitem I type icon 008 "x"\n';
  const board = Render.parse(src);
  assert.strictEqual(Render.nodeAlign(board, 'A'), 'center');
  assert.strictEqual(Render.nodeAlign(board, 'T'), 'top-left');
  assert.strictEqual(Render.nodeAlign(board, 'I'), 'left');
  assert.strictEqual(Render.authoredNodeAlign(board, 'A'), null);
}

{
  const src = 'boxes Demo\nitem A "x"\n';
  const next = Render.updateNodeAlign(src, 'A', 'top-left');
  const board = Render.parse(next);
  assert.strictEqual(Render.authoredNodeAlign(board, 'A'), 'top-left');
  assert.strictEqual(Render.nodeAlign(board, 'A'), 'top-left');
  const reset = Render.updateNodeAlign(next, 'A', 'center');
  assert.strictEqual(Render.authoredNodeAlign(Render.parse(reset), 'A'), null);
  assert.strictEqual(Render.authoredNodeAlign(Render.parse(Render.updateNodeAlign(src, 'A', 'center')), 'A'), null);
}

{
  const src = 'boxes Demo\nitem T type text "hi"\n';
  const next = Render.updateNodeAlign(src, 'T', 'center');
  assert.strictEqual(Render.authoredNodeAlign(Render.parse(next), 'T'), 'center');
  assert.strictEqual(Render.authoredNodeAlign(Render.parse(Render.updateNodeAlign(src, 'T', 'top-left')), 'T'), null);
}

{
  const src = 'boxes Demo\nbox CARD "Title"\nitem A "x"\n';
  assert.throws(() => Render.updateNodeAlign(src, 'CARD', 'center'), /align is for items/);
}

{
  const src = 'boxes Demo\nitem A "x"\n';
  const board = Render.parse(src);
  board.style = { ids: { A: { align: 'nope', fz: 1 } } };
  const again = Render.parse(Render.serialize(board));
  assert.strictEqual(Render.authoredNodeAlign(again, 'A'), null);
  assert.strictEqual(Render.nodeTypeStep(again, 'A'), 1);
}

console.log('ok item-align');
