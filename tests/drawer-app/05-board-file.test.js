'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const css = read('packages/drawer-app/css/03-diagram.css');
const chromeCss = read('packages/drawer-app/css/07-cloud-chrome.css');
const build = read('scripts/drawer-app-build/build.mjs');
const boardFile = read('packages/drawer-app/js/05-board-file.js');
const renderIo = read('packages/drawer-app/js/05-render-io.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');
const cloud = read('packages/drawer-app/js/06-cloud-sync.js');

assert.doesNotMatch(html, /id="btnHistoryOpenFile"/, 'History does not expose Open File');
assert.doesNotMatch(html, />Open File</, 'Open File label is gone');
assert.doesNotMatch(html, /Local history:/, 'History does not name the local cache path');
assert.doesNotMatch(html, /id="btnBoardHistoryRefresh"[^>]*title=/, 'History Refresh has no hover hint');
assert.match(html, /id="btnBoardHistoryRefresh"/, 'History still has Refresh');
assert.match(build, /05-board-file\.js/, 'build still includes the title helper module');
assert.match(boardFile, /function boardTitleFromBody/, 'board title is read from source');
assert.doesNotMatch(boardFile, /openBoardFile|showOpenFilePicker|input\.type = "file"/, 'file picker is gone');
assert.doesNotMatch(boot, /openBoardFile|btnHistoryOpenFile/, 'Open File is not wired');
assert.doesNotMatch(boot, /~\/\.cache\/board\/history/, 'History heading has no local cache path hint');
assert.doesNotMatch(cloud, /Local history:/, 'cloud history does not name the local cache path');
assert.doesNotMatch(cloud, /btnHistoryOpenFile/, 'cloud chrome does not retitle Open File');
assert.doesNotMatch(renderIo, /\.title = "Delete snapshot"/, 'local History delete has no hover hint');
assert.doesNotMatch(cloud, /\.title = "Delete cloud board"/, 'Cloud history delete has no hover hint');
assert.match(css, /\[data-persist="hash"\]:not\(\[data-cloud-history="on"\]\) #boardHistory\s*\{/, 'unsigned hash mode hides History');
assert.match(css, /\[data-persist="hash"\]\[data-cloud-history="on"\] #boardHistoryCombo/, 'signed-in hash mode shows cloud History');
assert.doesNotMatch(css, /#btnHistoryOpenFile/, 'Open File styles are gone');
assert.match(css, /\.history-actions\s*\{[^}]*margin-left:\s*auto/, 'History actions align on the right');
assert.match(html, /class="float top-float"[\s\S]*id="boardHistory"/, 'Cloud History sits on the top-right');
assert.doesNotMatch(html, /data-dock-panel="source"[\s\S]*id="boardHistory"/, 'Cloud History left the Source dock');
assert.match(html, /id="boardDock"[\s\S]*id="boardAccount"/, 'account chrome sits after the dock');
assert.match(chromeCss, /html\[data-drawer-mode="board"\] \.top-float #boardHistory\s*\{[^}]*margin:\s*0 0 0 auto/,
  'Cloud History aligns on the right');
assert.match(chromeCss, /html\[data-drawer-mode="board"\] \.top-float #boardHistory\s*\{[^}]*max-width:\s*320px/,
  'Cloud History input is a wider field');
assert.match(css, /\.history-combo-input \{[^}]*box-shadow:\s*inset/,
  'History field is inset like an input, not a raised button');
assert.doesNotMatch(css, /\.history-combo-input \{[^}]*font-weight:\s*550/,
  'History field does not bold the value');
assert.match(chromeCss, /html\[data-drawer-mode="board"\] \.board-account\s*\{[^}]*bottom:\s*8px/,
  'account chrome sits on the sidebar foot');
assert.doesNotMatch(chromeCss, /#boardCloudStatus \{\s*display:\s*none/,
  'Saved stays its own control');
assert.match(html, /class="board-cloud-status-icon"/, 'Saved is a sidebar-style icon');
assert.match(chromeCss, /\.board-account \.board-cloud-status \{[^}]*background:\s*transparent/,
  'Saved matches the rail icon chrome');
assert.match(css, /Keep editing controls left and account controls right\.[\s\S]*right:\s*48px/,
  'top chrome still clears the right-side dock');
assert.match(cloud, /function applyLocalSignedInPreview/, '127 can preview signed-in chrome');
assert.match(cloud, /host === "127\.0\.0\.1"/, 'signed-in preview stays on localhost');
assert.match(cloud, /if \(cloudSession && cloudSession\.user\) return/,
  'real sessions replace the local preview');

console.log('ok board-file');
