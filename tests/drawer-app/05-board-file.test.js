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
const renderIo = read('packages/drawer-app/js/05-render-io.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');
const cloud = read('packages/drawer-app/js/06-cloud-sync.js');

assert.doesNotMatch(html, /id="boardHistory"/, 'the toolbar History dropdown is gone (the left drawer and search replace it)');
assert.doesNotMatch(html, /id="btnBoardHistoryRefresh"|id="btnHistoryOpenFile"/, 'no History controls remain');
assert.doesNotMatch(renderIo, /refreshBoardHistory|restoreBoardHistory|deleteBoardHistory|wireHistoryCombos/, 'history combo code is gone');
assert.doesNotMatch(boot, /openBoardFile|btnHistoryOpenFile|wireBoardHistory/, 'Open File and History are not wired');
assert.doesNotMatch(cloud, /refreshCloudBoardHistory|cloudSetHistoryVisible|paintLocalHistoryPreview|cloudShowHistoryMessage/, 'cloud history helpers are gone');
assert.match(cloud, /async function cloudRefreshGroups/, 'the drawer list refresh replaces the history refresh');
assert.doesNotMatch(css, /\.history-(combo|item|pop|list|block)|#boardHistory/, 'history styles are gone');
assert.doesNotMatch(chromeCss, /#boardHistory/, 'history chrome styles are gone');
assert.match(chromeCss, /html\[data-drawer-mode="vela"\] \.board-account\s*\{[^}]*bottom:\s*8px/,
  'account chrome sits on the sidebar foot');
assert.doesNotMatch(chromeCss, /#boardCloudStatus \{\s*display:\s*none/,
  'Saved stays its own control');
assert.match(html, /class="board-cloud-status-icon"/, 'Saved is a sidebar-style icon');
assert.doesNotMatch(html, /board-cloud-status-icon"[\s\S]*?<rect /,
  'Saved icon has no drawn frame');
assert.match(css, /\.board-cloud-status:hover \{[^}]*background:\s*color-mix\(in srgb, var\(--text\) 6%/,
  'Saved hover matches the rail icon plate');
assert.match(chromeCss, /\.board-account \.board-cloud-status \{[^}]*background:\s*transparent/,
  'Saved matches the rail icon chrome');
assert.match(css, /Keep editing controls left and account controls right\.[\s\S]*right:\s*48px/,
  'top chrome still clears the right-side dock');
assert.match(cloud, /function applyLocalSignedInPreview/, '127 can preview signed-in chrome');
assert.match(cloud, /host === "127\.0\.0\.1"/, 'signed-in preview stays on localhost');
assert.match(cloud, /if \(cloudSession && cloudSession\.user\) return/,
  'real sessions replace the local preview');

console.log('ok board-file');
