'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Themes = require('../../../packages/boxes/themes');

// default pack: warm paper fills, first one is the card colour
const pack = Themes.get('default');
assert.strictEqual(pack.colors[0], '#fffdf9');

// form layer: cards have no CSS border (the edge is an inset ring), are rounded and lifted
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/04-board-form.css'), 'utf8');
assert.match(css, /\.box\.board-type-card\s*\{[^}]*border:\s*0 !important/);
assert.match(css, /\.board-type-card \.box\.board-type-card\s*\{[^}]*box-shadow:\s*var\(--bf-edge-in\)/, 'nested card: edge ring, no lift');
assert.doesNotMatch(css, /color-mix\(in srgb, var\(--board-card-zone-bg/, 'nested card fill comes from the rotation, not a mix');
console.log('ok card-form');

// container keeps the dashed shell but follows the same 12px corner as cards
const form = css;
assert.match(form, /board-type-container,[^{]*\{\s*border-radius:\s*var\(--bf-radius-box\) !important/);
const diagram = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
assert.match(diagram, /border:\s*1\.5px dashed var\(--board-container-zone-border/);
assert.doesNotMatch(diagram, /board-type-container > \.box-title[^}]*opacity:\s*0\.72/);

// chips: no CSS border (the edge is an inset ring), 8px, warm inline code
assert.match(css, /board-item-type-chip:not\(\.board-item-diamond\)\s*\{[^}]*border:\s*0 !important[^}]*border-radius:\s*var\(--bf-radius-chip\)/);
assert.match(css, /\.board-item-md code\s*\{[^}]*rgba\(90, 67, 48/);

// diamond chip: the same edge as the rect chip; the face takes its rotation colour through --bf-fill
assert.match(css, /board-item-diamond-face\s*\{[^}]*stroke:\s*var\(--bf-edge\)/);
assert.match(css, /board-item-diamond\[data-bf-fill\] \.board-item-diamond-face\s*\{[^}]*fill:\s*var\(--bf-fill\) !important/);

// note: cream paper without an outline, quieter title
assert.match(css, /board-item-note-sheet\s*\{[^}]*background:\s*#fff6dc[^}]*border:\s*0/);
assert.match(css, /board-item-note \.board-item-md h1\s*\{[^}]*font-size:\s*1\.15em/);

// every pack has a first fill that is not plain white
['default', 'classic', 'pastel'].forEach((id) => {
  const kit = Themes.kitFor(id, 'card');
  assert.ok(kit.cardBg && kit.cardBg.toLowerCase() !== '#fff' && kit.cardBg.toLowerCase() !== '#ffffff', id + ' first fill');
});

// diamond corners are rounded (path with arcs, not a sharp polygon) and the halo follows them
const dsrc = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/box/diamond.js'), 'utf8');
assert.match(dsrc, /function roundedRhombusPath/);
assert.match(dsrc, /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'path'\)/);
assert.doesNotMatch(dsrc, /stroke-linejoin', 'miter'/);

// ---- edge colour follows the theme (LB-328) ----
{
  const fs = require('fs');
  const path = require('path');
  const Themes = require('../../../packages/boxes/themes');
  const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/04-board-form.css'), 'utf8');
  assert.match(css, /\.board-render \{\s*--bf-edge: rgba\(var\(--bf-rgb/, 'ring colour is derived from --bf-rgb on the board root');
  assert.doesNotMatch(css, /:root \{[^}]*--bf-edge/, 'no theme-blind ring colour left on :root');
  Themes.ORDER.forEach((id) => {
    const theme = Themes.get(id);
    assert.match(theme.edgeRgb, /^\d+, \d+, \d+$/, id + ' has an edge colour');
    const container = Themes.kitFor(theme, 'container');
    assert.strictEqual(container.zoneBorder, 'rgba(' + theme.edgeRgb + ', .3)', id + ' container dash is its edge colour at .3');
  });
  assert.strictEqual(Themes.get('default').edgeRgb, '74, 53, 36', 'default look is unchanged');
}

// ---- default edge: deeper than the node's own fill, for card / chip / diamond (LB-333) ----
{
  assert.match(css, /--bf-edge: rgba\(var\(--bf-rgb[^)]*\), \.14\)/, 'edge = theme edge colour at .14, laid over the fill');
  assert.match(css, /--bf-edge-in: inset 0 0 0 1px var\(--bf-edge\)/, 'drawn inside, so layout does not change');
  assert.match(css, /--bf-shadow-box: var\(--bf-edge-in\), /, 'outermost card keeps its lift, the ring is the new edge');
  assert.match(css, /board-item-type-chip:not\(\.board-item-diamond\)\s*\{[^}]*box-shadow:\s*var\(--bf-edge-in\) !important/, 'rect chip has the edge');
  assert.match(css, /\.board-item-diamond-face\s*\{[^}]*stroke:\s*var\(--bf-edge\)/, 'diamond has the same edge');
  assert.doesNotMatch(css, /\.board-item-type-chip:not\(\.board-item-diamond\)\s*\{[^}]*box-shadow:\s*none/, 'chip is no longer edgeless');
}
