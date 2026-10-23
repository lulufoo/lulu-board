'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// the engine colours nodes through the rotation only: no global counter, no per-box tone call
const root = path.join(__dirname, '../../../packages/boxes');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const render = read('engine/board-render.js');
assert.match(render, /fills: Rotation && Themes \? Rotation\.resolve\(board, Themes\.get\(themeId\)\.colors\)/);
assert.doesNotMatch(render, /toneSeq|toneRamp|BoardTone|autoTone/, 'board-render no longer uses the old tone');
['box/board-box.js', 'item/board-item.js'].forEach((rel) => {
  const src = read(rel);
  assert.match(src, /BoardRotation\.paint\(el, ctx\.fills\.get\(/, rel + ' paints from ctx.fills');
  assert.doesNotMatch(src, /BoardTone|toneSeq|applyBoxTone/, rel + ' no longer uses the old tone');
});
// box diamond: the stroke is the theme edge colour, not a swatch border
assert.doesNotMatch(read('box/diamond.js'), /cardBorder|kitFor/);
// the rotation is bundled
assert.match(fs.readFileSync(path.join(__dirname, '../../../scripts/board-build/build.mjs'), 'utf8'), /'themes\/rotation\.js'/);
console.log('ok rotation-wiring');
