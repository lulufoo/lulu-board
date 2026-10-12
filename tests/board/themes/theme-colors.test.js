'use strict';
const assert = require('assert');
const Themes = require('../../../packages/board/themes');

// every theme has one list of plain fills, in rotation order
Themes.ORDER.forEach((id) => {
  const theme = Themes.get(id);
  assert.strictEqual(theme.colors.length, 8, id + ' has 8 fills');
  theme.colors.forEach((c) => assert.match(c, /^#[0-9a-f]{6}$/i, id + ' fill ' + c));
  assert.strictEqual(new Set(theme.colors).size, 8, id + ' fills are distinct');
  ['swatches', 'ramp', 'autoTone'].forEach((k) => assert.strictEqual(theme[k], undefined, id + ' has no ' + k));
});
assert.strictEqual(Themes.get('default').colors[0], '#fffdf9', 'default starts with the card colour');
console.log('ok theme-colors');
