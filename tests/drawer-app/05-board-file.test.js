'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const css = read('packages/drawer-app/css/03-diagram.css');
const build = read('scripts/drawer-app-build/build.mjs');
const openFile = read('packages/drawer-app/js/05-board-file.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');

assert.match(html, /id="btnHistoryOpenFile"/, 'History exposes Open File');
assert.match(html, />Open File</, 'Open File label is English');
assert.match(build, /05-board-file\.js/, 'build includes board file module');
assert.match(openFile, /function openBoardFile/, 'opens a board file');
assert.match(openFile, /showOpenFilePicker/, 'prefers a file picker');
assert.match(openFile, /input\.type = "file"/, 'falls back to a file input');
assert.doesNotMatch(openFile, /127\.0\.0\.1/, 'does not call loopback Drawer');
assert.match(openFile, /saveBoardToHash/, 'writes the opened file into the hash');
assert.doesNotMatch(openFile, /boardHistoryCombo/, 'does not open the History combo');
assert.match(boot, /btnHistoryOpenFile.*openBoardFile/, 'Open File button is wired');
assert.match(boot, /boardPersistMode\(\) === "hash"[\s\S]*~\/\.cache\/board\/history/, 'hash History row titles the SKILL cache path');
assert.match(css, /\[data-persist="hash"\] #boardHistoryCombo/, 'hash mode hides the History combo');
assert.match(css, /\[data-persist="hash"\] #btnHistoryOpenFile/, 'hash mode shows Open File');
assert.doesNotMatch(css, /\[data-persist="hash"\] #boardHistory\s*\{/, 'hash mode does not hide the History block');

console.log('ok board-file');
