import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const main = read('packages/drawer-app/src/main.js');
const diagram = read('packages/drawer-app/src/kinds/diagram.js');
const picker = read('packages/drawer-app/src/chrome/theme-picker.js');
const popup = read('packages/drawer-app/src/chrome/popup-select.js');
const css = read('packages/drawer-app/css/09-popup-select.css');

assert.match(html, /id="kindThemeSelect"[^>]*hidden/, 'native theme select stays hidden');
assert.match(html, /id="themeSelectHost"/, 'theme listbox has a host');
assert.match(main, /import '\.\/chrome\/theme-picker\.js'/, 'theme picker is booted from main');
assert.match(picker, /import \{ mountPopupSelect \} from '\.\/popup-select\.js'/, 'theme picker reuses the listbox');
assert.match(picker, /table\.diagram\.edgeStroke/, 'theme icon uses the appearance edge color');
assert.match(picker, /kindThemeSelect/, 'theme picker mirrors the native select');
assert.match(popup, /openMenus/, 'opening one listbox closes the others');
assert.match(popup, /export function bindNativeSelect/, 'native selects share the listbox binder');
assert.match(popup, /function setOptions/, 'listbox options can change after mount');
assert.match(popup, /function setDisabled/, 'listbox can disable');
assert.match(css, /\.ps-trigger/, 'listbox trigger is styled');
assert.match(css, /background-color: var\(--chip\)/, 'open trigger uses the appearance chip');
assert.match(css, /\.ps-option\[aria-selected="true"\]\s*\{[^}]*background-color:\s*var\(--chip\)/, 'selected row uses the appearance chip');
assert.match(css, /\.ps-menu\s*\{[^}]*background:\s*var\(--fill\)/, 'menu uses the appearance fill');
assert.doesNotMatch(css, /background-color: #fff/, 'open trigger is not hard-coded white');
assert.doesNotMatch(css, /\.ps-menu\s*\{[^}]*background:\s*#fff/, 'menu is not hard-coded white');
assert.match(css, /\.ps-icon\.is-glyph/, 'theme chips are not dotted discs');
assert.match(css, /select\.ps-bound/, 'bound native selects are visually hidden');
assert.doesNotMatch(html, /groundSelectHost/, 'background listbox is gone');
assert.doesNotMatch(main, /ground-picker/, 'background picker is not booted');
assert.match(main, /import '\.\/chrome\/native-selects\.js'/, 'remaining dock selects are bound');
const natives = read('packages/drawer-app/src/chrome/native-selects.js');
['boardTypeEditor', 'boardArrowEditor', 'boardDirEditor', 'board-align-x-editor', 'board-align-y-editor', 'flowchartTypeEditor', 'flowchartDirEditor', 'mindmapLayoutEditor', 'boardShapeEditor'].forEach((id) => {
  assert.match(natives, new RegExp(id), id + ' is bound to popup-select');
});
assert.match(html, /id="boardShapeEditor"/, 'Shape is a select, not a segment');
assert.match(html, /id="boardShapeHost"/, 'Shape has a listbox host');
assert.doesNotMatch(html, /props-shape-btn/, 'Shape segment buttons are gone');
assert.doesNotMatch(html, /id="boardCapEditor"/, 'Width Cap leftover select is gone');
assert.doesNotMatch(html, /Width Cap/, 'Width Cap leftover label is gone');
assert.doesNotMatch(diagram, /emit\("applyDocumentGround"/, 'opening a document does not sync a background picker');

console.log('ok popup-select check');
