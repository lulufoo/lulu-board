import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const Themes = require('../../../packages/boxes/themes');

// every theme has one list of plain fills, in rotation order
Themes.ORDER.forEach((id) => {
  const theme = Themes.get(id);
  assert.strictEqual(theme.colors.length, 8, id + ' has 8 fills');
  theme.colors.forEach((c) => assert.match(c, /^#[0-9a-f]{6}$/i, id + ' fill ' + c));
  assert.strictEqual(new Set(theme.colors).size, 8, id + ' fills are distinct');
  ['swatches', 'ramp', 'autoTone'].forEach((k) => assert.strictEqual(theme[k], undefined, id + ' has no ' + k));
});
assert.strictEqual(Themes.get('default').colors[0], '#fffdf9', 'default starts with the card colour');
assert.strictEqual(Themes.edgeTint('default'), 'rgba(74, 53, 36, .14)');
assert.strictEqual(Themes.kitFor('default', 'card').cardBorder, Themes.edgeTint('default', Themes.EDGE_DASH_ALPHA));
assert.strictEqual(Themes.BOX_RX, 4, 'filled box corner is 4px');
assert.strictEqual(Themes.FILL_STROKE_DARKEN, 0.1, 'stroke is 10% darker than fill');
assert.strictEqual(
  Themes.strokeFromFill('#fffdf9'),
  'color-mix(in srgb, #fffdf9 90%, rgb(var(--bf-rgb, 74, 53, 36)))',
  'stroke-from-fill mixes 10% theme ink into the fill',
);
assert.strictEqual(
  Themes.strokeFromFill('var(--_s)'),
  'color-mix(in srgb, var(--_s) 90%, rgb(var(--bf-rgb, 74, 53, 36)))',
);
assert.strictEqual(Themes.FILL_STROKE_INK, 'rgb(var(--bf-rgb, 74, 53, 36))');
{
  const vars = {};
  Themes.applyTo({ style: { setProperty: (k, v) => { vars[k] = v; } }, dataset: {} }, 'dark');
  assert.strictEqual(vars['--board-color'], Themes.get('dark').color);
  assert.strictEqual(vars['--board-card-bg'], Themes.get('dark').colors[0]);
  assert.strictEqual(vars['--board-note-sheet'], '#c9a63a');
  assert.strictEqual(vars['--board-note-fold'], '#a88828');
  assert.strictEqual(vars['--board-note-ink'], '#2c220e');
  assert.strictEqual(vars['--board-title-color'], '#f7efe4');
}
console.log('ok theme-colors');
