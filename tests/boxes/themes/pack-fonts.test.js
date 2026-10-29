import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Themes = require('../../../packages/boxes/themes');
const Scale = require('../../../packages/boxes/themes/type-scale');

// One font stack and one set of weights for every theme; they live next to the size ladder.
assert.match(Scale.FONT_FAMILY, /SF Pro Text.*Inter/, 'the shared stack is the site font stack');
assert.match(Scale.FONT_FAMILY, /PingFang SC/, 'the shared stack has a CJK sans fallback');
const W = Scale.WEIGHT;
assert.deepStrictEqual(W, { title: '550', text: '500', note: '400', bold: '650' });
assert.ok(Number(W.text) <= Number(W.title), 'item text is not heavier than the box title, or the title reads as the weakest line');
const root = path.join(__dirname, '../../..');
for (const id of Themes.ORDER) {
  const theme = Themes.get(id);
  assert.strictEqual(theme.fontFamily, Scale.FONT_FAMILY, id + ' uses the shared font');
  const src = fs.readFileSync(path.join(root, 'packages/boxes/themes/packs/chrome-' + id + '.js'), 'utf8');
  assert.doesNotMatch(src, /fontFamily/, id + ' pack does not define its own font');
  assert.doesNotMatch(src, /titleWeight/, id + ' pack does not define its own weight');
  assert.strictEqual(Themes.kitFor(theme, 'card').titleWeight, W.title, id + ' card title uses the shared weight');
  assert.strictEqual(Themes.kitFor(theme, 'container').titleWeight, W.title, id + ' container title is the same box title weight');
}

// applyTo publishes every weight as a CSS variable on the board root.
const vars = {};
Themes.applyTo({ style: { setProperty: (k, v) => { vars[k] = v; } }, dataset: {} }, 'default');
const VAR_KEY = {
  '--board-title-weight': 'title',
  '--board-card-title-weight': 'title',
  '--board-container-title-weight': 'title',
  '--board-item-text-weight': 'text',
  '--board-note-weight': 'note',
  '--board-bold-weight': 'bold',
};
for (const [name, key] of Object.entries(VAR_KEY)) assert.strictEqual(vars[name], W[key], name + ' comes from WEIGHT.' + key);

// edge labels (SVG text) inherit the same --board-font as boxes and items
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/03-diagram.css'), 'utf8');
assert.doesNotMatch(css, /Trebuchet/, 'no theme-specific font left in the diagram CSS');
assert.doesNotMatch(css, /\.board-edge-label\s*\{[^}]*font-family/, 'link labels do not set their own font family');

// The title text is a <strong>. Without this rule the browser's `bolder` lifts any title weight of 550 or more to 900.
assert.match(css, /\.board-title-name\s*\{[^}]*font-weight:\s*inherit/, 'the title text follows the title weight instead of the strong default');

// The CSS rules read the variables. The container rule reads no weight at all (it takes the shared one from
// .board-zone-title), so its variable has no reader.
for (const name of Object.keys(VAR_KEY)) {
  if (name === '--board-container-title-weight') continue;
  assert.match(css, new RegExp('var\\(' + name + '[,)]'), name + ' is read by the diagram CSS');
}
for (const sel of ['\\.board-item-type-text \\.board-item-text', '\\.board-item-icon \\.board-item-text']) {
  const rule = new RegExp(sel + '\\s*\\{([^}]*)\\}').exec(css);
  assert.ok(rule && /font-weight:\s*var\(--board-item-text-weight/.test(rule[1]), sel + ' takes its weight from the shared variable, not a literal');
}
// Container titles are box titles too: their rule sets no weight, so they take the shared one from .board-zone-title.
const containerRule = /\.board-type-container > \.box-title\.board-zone-title\s*\{([^}]*)\}/.exec(css);
assert.ok(containerRule, 'container title rule exists');
assert.doesNotMatch(containerRule[1], /font-weight/, 'container title rule does not set its own weight');
assert.match(css, /\.board-item-md strong \{ font-weight: var\(--board-bold-weight/, 'markdown bold uses the shared weight');
assert.match(css, /\.board-item-type-note,[^{]*\{[^}]*font-weight:\s*var\(--board-note-weight/, 'note items use the shared weight');
console.log('ok pack-fonts');
