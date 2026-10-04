'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const appBuild = read('scripts/drawer-app-build/build.mjs');
const cloud = read('packages/drawer-app/js/06-cloud-sync.js');
const tabs = read('packages/drawer-app/js/06-cloud-group-tabs.js');
const tabCss = read('packages/drawer-app/css/06-group-tabs.css');
const dockCss = read('packages/drawer-app/css/03-diagram.css');
const boardJs = read('packages/drawer-app/js/02-board.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');

assert.match(html, /id="board-group-tabs"/, 'canvas keeps a group tab strip');
assert.match(appBuild, /06-cloud-group-tabs\.js/, 'drawer app concatenates group tab chrome');
assert.match(dockCss, /html\[data-drawer-mode="board"\] \.zoom-float \{ right: 88px; \}/, 'zoom clears the group tab column');
assert.match(tabCss, /\.group-tab-float/, 'group tabs are canvas chrome');
assert.match(tabCss, /flex-direction: column/, 'group tabs stack vertically');
assert.match(tabCss, /z-index: 4/, 'open dock covers the tab strip');
assert.match(tabs, /cloudStartPlusDraft/, 'plus starts a local draft');
assert.match(tabs, /Leave without saving/, 'dirty saved tabs confirm before leave');
assert.match(tabs, /isShareGuest/, 'share guests do not see group tabs');
assert.match(cloud, /joinGroupId = cloudPlusDraft && cloudGroupId \? cloudGroupId : null/);
assert.match(cloud, /p_group_id:\s*joinGroupId/);
assert.match(cloud, /cloudPlusDraft && !opts\.explicit/, 'plus draft does not autosave');
assert.match(cloud, /refreshCloudGroupMembers/, '#b: then refreshes group tabs');
assert.match(cloud, /async function deleteCloudGroup/, 'history × deletes a group');
assert.doesNotMatch(cloud, /history-group-members/, 'history lists groups, not member boards');
assert.match(boardJs, /cloudPlusDraft/, 'autosave skips plus drafts');
assert.match(boot, /!cloudPlusDraft/, 'hashchange does not flush a plus draft');

{
  const start = tabs.indexOf('function sortBoardRowsByCreatedAt');
  const end = tabs.indexOf('function cloudGroupTabsVisible');
  assert.ok(start >= 0 && end > start, 'sortBoardRowsByCreatedAt is a closed function');
  const helpers = new Function(tabs.slice(start, end) + '\nreturn { sortBoardRowsByCreatedAt };')();
  const sorted = helpers.sortBoardRowsByCreatedAt([
    { board_id: 'b_22222222', created_at: '2026-10-04T12:00:00Z' },
    { board_id: 'b_11111111', created_at: '2026-10-04T10:00:00Z' },
  ]);
  assert.deepStrictEqual(sorted.map((row) => row.board_id), ['b_11111111', 'b_22222222']);
}

console.log('ok cloud-group-tabs');
