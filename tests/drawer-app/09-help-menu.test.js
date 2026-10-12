'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'packages/drawer-app/js/09-shortcuts.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/09-shortcuts.css'), 'utf8');

const rail = html.slice(html.indexOf('class="board-dock-rail'), html.indexOf('id="propsPanel"'));
assert.strictEqual((rail.match(/board-dock-help"/g) || []).length, 1, 'the dock rail has one help entry');
assert.doesNotMatch(rail, /id="btnBoardOnboarding"|id="btnBoardShortcuts"/, 'Welcome and Shortcuts are not separate dock buttons');
assert.match(rail, /id="btnBoardHelp"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*aria-controls="boardHelpMenu"/, 'help button announces its menu');
assert.match(rail, /board-dock-help-glyph" aria-hidden="true">\?</, 'help button shows ?');

const menu = html.slice(html.indexOf('id="boardHelpMenu"'), html.indexOf('id="shortcutsDialog"'));
assert.match(menu, /role="menu"/, 'menu role');
const items = menu.match(/role="menuitem"/g) || [];
assert.strictEqual(items.length, 2, 'two menu items');
assert.match(menu, /id="btnBoardOnboarding"[\s\S]*Welcome[\s\S]*id="btnBoardShortcuts"[\s\S]*Keyboard shortcuts[\s\S]*<kbd class="shortcuts-key">\?<\/kbd>/, 'Welcome, then Keyboard shortcuts with the ? hint');

assert.match(js, /function wireHelpMenu/, 'menu is wired');
assert.match(js, /setAttribute\("aria-expanded", "true"\)/, 'aria-expanded tracks the menu');
assert.match(js, /"pointerdown"[\s\S]*setOpen\(false\)/, 'outside click closes');
assert.match(js, /event\.key === "Escape"[\s\S]*setOpen\(false\)/, 'Esc closes');
assert.match(js, /item\.addEventListener\("click", function \(\) \{ setOpen\(false\); \}, true\)/, 'choosing an item closes');
assert.match(js, /event\.key === "\?"/, '? still opens the shortcuts dialog');
assert.match(js, /shortcuts=open/, '?shortcuts=open still works');
assert.match(css, /\.board-help-menu\[hidden\] \{ display: none; \}/, 'hidden menu stays hidden');
console.log('ok help-menu');
