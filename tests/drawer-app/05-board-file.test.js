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
const renderIo = read('packages/drawer-app/js/05-render-io.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');
const cloud = read('packages/drawer-app/js/06-cloud-sync.js');

assert.match(html, /id="btnHistoryOpenFile"/, 'History exposes Open File');
assert.match(html, />Open File</, 'Open File label is English');
assert.match(html, /class="history-actions"[\s\S]*id="btnBoardHistoryRefresh"[\s\S]*id="btnHistoryOpenFile"/,
  'History actions stay in one ordered group');
assert.match(html, /id="btnHistoryOpenFile" title="Open a board file\."/,
  'History Open File has a short hint');
assert.doesNotMatch(html, /Local history:/, 'Open File does not name the local cache path');
assert.doesNotMatch(html, /id="btnBoardHistoryRefresh"[^>]*title=/, 'History Refresh has no hover hint');
assert.match(build, /05-board-file\.js/, 'build includes board file module');
assert.match(openFile, /function openBoardFile/, 'opens a board file');
assert.match(openFile, /showOpenFilePicker/, 'prefers a file picker');
assert.match(openFile, /input\.type = "file"/, 'falls back to a file input');
assert.doesNotMatch(openFile, /127\.0\.0\.1/, 'does not call loopback Drawer');
assert.match(openFile, /saveBoardToHash/, 'writes the opened file into the hash');
assert.doesNotMatch(openFile, /boardHistoryCombo/, 'does not open the History combo');
assert.match(boot, /btnHistoryOpenFile.*openBoardFile/, 'Open File button is wired');
assert.doesNotMatch(boot, /~\/\.cache\/board\/history/, 'History heading has no local cache path hint');
assert.doesNotMatch(cloud, /Local history:/, 'cloud Open File does not name the local cache path');
assert.doesNotMatch(renderIo, /\.title = "Delete snapshot"/, 'local History delete has no hover hint');
assert.doesNotMatch(cloud, /\.title = "Delete cloud board"/, 'Cloud history delete has no hover hint');
assert.match(cloud, /openFile\.title = visible[\s\S]*Cloud history/, 'Cloud history Open File has a distinct hint');
assert.match(css, /\[data-persist="hash"\]:not\(\[data-cloud-history="on"\]\) #boardHistoryCombo/, 'unsigned hash mode hides the History combo');
assert.match(css, /\[data-persist="hash"\]\[data-cloud-history="on"\] #boardHistoryCombo/, 'signed-in hash mode shows cloud History');
assert.match(css, /\[data-persist="hash"\] #btnHistoryOpenFile/, 'hash mode shows Open File');
assert.doesNotMatch(css, /\[data-persist="hash"\] #boardHistory\s*\{/, 'hash mode does not hide the History block');
assert.match(css, /\.history-actions\s*\{[^}]*margin-left:\s*auto/, 'History actions align on the right');
assert.match(css, /html\[data-drawer-mode="board"\] \.board-account\s*\{[^}]*margin-left:\s*auto/,
  'account controls align on the right');
assert.match(css, /Keep editing controls left and account controls right\.[\s\S]*right:\s*48px/,
  'account controls clear the right-side dock');

console.log('ok board-file');
