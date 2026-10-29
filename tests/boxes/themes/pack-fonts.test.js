import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Themes = require('../../../packages/boxes/themes');
const Scale = require('../../../packages/boxes/themes/type-scale');

// One font stack and one title weight for every theme; they live next to the size ladder.
assert.match(Scale.FONT_FAMILY, /SF Pro Text.*Inter/, 'the shared stack is the site font stack');
assert.match(Scale.FONT_FAMILY, /PingFang SC/, 'the shared stack has a CJK sans fallback');
assert.strictEqual(Scale.TITLE_WEIGHT, '650');
const root = path.join(__dirname, '../../..');
for (const id of Themes.ORDER) {
  const theme = Themes.get(id);
  assert.strictEqual(theme.fontFamily, Scale.FONT_FAMILY, id + ' uses the shared font');
  const src = fs.readFileSync(path.join(root, 'packages/boxes/themes/packs/chrome-' + id + '.js'), 'utf8');
  assert.doesNotMatch(src, /fontFamily/, id + ' pack does not define its own font');
  const box = Themes.kitFor(theme, 'card', 0, 8);
  assert.strictEqual(box.titleWeight, Scale.TITLE_WEIGHT, id + ' card title uses the shared weight');
}
// edge labels (SVG text) inherit the same --board-font as boxes and items
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/03-diagram.css'), 'utf8');
assert.doesNotMatch(css, /Trebuchet/, 'no theme-specific font left in the diagram CSS');
assert.doesNotMatch(css, /\.board-edge-label\s*\{[^}]*font-family/, 'link labels do not set their own font family');
// The title text is a <strong>. Without this rule the browser's `bolder` lifts any title weight of 550 or more to 900.
assert.match(css, /\.board-title-name\s*\{[^}]*font-weight:\s*inherit/, 'the title text follows the title weight instead of the strong default');
console.log('ok pack-fonts');
