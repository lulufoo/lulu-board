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
const picker = read('packages/drawer-app/src/chrome/theme-picker.js');
const popup = read('packages/drawer-app/src/chrome/popup-select.js');
const css = read('packages/drawer-app/css/09-popup-select.css');

assert.match(html, /id="kindThemeSelect"[^>]*hidden/, 'native theme select stays hidden');
assert.match(html, /id="themeSelectHost"/, 'theme listbox has a host');
assert.match(main, /import '\.\/chrome\/theme-picker\.js'/, 'theme picker is booted from main');
assert.match(picker, /import \{ mountPopupSelect \} from '\.\/popup-select\.js'/, 'theme picker reuses the listbox');
assert.match(picker, /theme\.edgeStroke/, 'theme icon uses the theme link color');
assert.match(picker, /kindThemeSelect/, 'theme picker mirrors the native select');
assert.match(popup, /openMenus/, 'opening one listbox closes the others');
assert.match(css, /\.ps-trigger/, 'listbox trigger is styled');
assert.match(css, /\.ps-icon\.is-glyph/, 'theme chips are not dotted discs');

console.log('ok popup-select check');
