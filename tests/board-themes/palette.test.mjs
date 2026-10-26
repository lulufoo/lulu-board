import assert from 'node:assert';
import {
  BOX_RX,
  FILL_STROKE_DARKEN,
  FILL_STROKE_INK,
  LEGACY_IDS,
  ORDER,
  edgeTint,
  get,
  list,
  resolveId,
  ring,
  strokeFromFill,
} from '../../packages/board-themes/index.js';

assert.deepStrictEqual(list().map((t) => t.id), ['default', 'classic', 'pastel']);
assert.deepStrictEqual(ORDER, ['default', 'classic', 'pastel']);
assert.deepStrictEqual(LEGACY_IDS, {
  minimal: 'classic',
  slate: 'pastel',
  kami: 'default',
});
assert.strictEqual(resolveId('minimal'), 'classic');
assert.strictEqual(resolveId('slate'), 'pastel');
assert.strictEqual(resolveId('kami'), 'default');
assert.strictEqual(resolveId('a-theme-that-was-removed'), 'default');
assert.strictEqual(get('kami').id, 'default');
assert.strictEqual(get('slate').id, 'pastel');
assert.strictEqual(get().id, 'default');

assert.strictEqual(get('default').colors[0], '#fffdf9');
assert.strictEqual(edgeTint('default'), 'rgba(74, 53, 36, .14)');
assert.strictEqual(BOX_RX, 4);
assert.strictEqual(FILL_STROKE_DARKEN, 0.1);
assert.strictEqual(
  strokeFromFill('#fffdf9'),
  'color-mix(in srgb, #fffdf9 90%, rgb(var(--bf-rgb, 74, 53, 36)))',
);
assert.strictEqual(FILL_STROKE_INK, 'rgb(var(--bf-rgb, 74, 53, 36))');

assert.deepStrictEqual(ring, {
  color: '#db4c84',
  hover: 'rgba(219, 76, 132, .4)',
  width: 2,
  offset: 2,
  gap: 3,
});

console.log('ok board-themes palette');
