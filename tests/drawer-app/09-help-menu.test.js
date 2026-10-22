'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'packages/drawer-app/js/09-shortcuts.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/09-shortcuts.css'), 'utf8');

const rail = html.slice(html.indexOf('class="diagram-dock-rail'), html.indexOf('id="propsPanel"'));
assert.strictEqual((rail.match(/diagram-dock-help"/g) || []).length, 1, 'the dock rail has one help entry');
assert.doesNotMatch(rail, /id="btnBoardOnboarding"|id="btnBoardShortcuts"/, 'Welcome and Shortcuts are not separate dock buttons');
assert.match(rail, /id="btnDiagramHelp"[^>]*aria-haspopup="dialog"[^>]*aria-controls="shortcutsDialog"/, 'help button opens the shortcuts dialog');
assert.match(rail, /title="Keyboard shortcuts"/, 'help button names shortcuts');
assert.match(rail, /diagram-dock-help-glyph" aria-hidden="true">\?</, 'help button shows ?');

assert.doesNotMatch(html, /id="diagramHelpMenu"|id="btnBoardOnboarding"|id="btnBoardShortcuts"/, 'the help menu is gone');
assert.doesNotMatch(js, /function wireHelpMenu/, 'no help menu wiring');
assert.match(js, /getElementById\("btnDiagramHelp"\)/, 'dock ? opens shortcuts');
assert.match(js, /event\.key === "\?"/, '? still opens the shortcuts dialog');
assert.match(js, /shortcuts\|help/, '?help=open still opens shortcuts');
assert.doesNotMatch(css, /\.diagram-help-menu/, 'help menu styles are gone');
console.log('ok help-menu');
