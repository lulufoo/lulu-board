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
const chromeCss = read('packages/drawer-app/css/02-chrome.css');
const dockCss = read('packages/drawer-app/css/03-diagram.css');
const boardJs = read('packages/drawer-app/js/02-board.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');

assert.match(html, /id="board-group-tabs"/, 'canvas keeps a group tab strip');
assert.match(appBuild, /06-cloud-group-tabs\.js/, 'drawer app concatenates group tab chrome');
assert.match(appBuild, /06-board-confirm\.js/, 'drawer app concatenates the in-app confirm');
assert.match(html, /id="boardConfirmDialog"/, 'canvas keeps one in-app confirm');
assert.match(chromeCss, /\.zoom-float \{[\s\S]*left: 50%;/, 'zoom / Fit sit at the bottom center');
assert.match(chromeCss, /show-chrome \.zoom-float/, 'zoom chrome still appears after a zoom change');
assert.doesNotMatch(tabCss, /right: 88px/, 'group tabs do not shove zoom left');
assert.doesNotMatch(dockCss, /\.zoom-float \{ right: 88px/, 'dock css does not shove zoom left');
assert.match(tabCss, /\.group-tab-float/, 'group tabs are canvas chrome');
assert.match(tabCss, /flex-direction: column/, 'group tabs stack vertically');
assert.match(tabCss, /z-index: 4/, 'open dock covers the tab strip');
assert.match(tabs, /cloudStartPlusDraft/, 'plus starts a local draft');
assert.match(tabs, /saveBoardToHash/, 'plus writes a blank #z: envelope');
assert.match(tabs, /cloudGroupMembers\.length \+ 1/, 'plus shows the next numbered tab');
assert.match(tabs, /plus\.disabled = !!cloudPlusDraft/, 'plus stays disabled until the draft is saved');
assert.match(tabs, /function cloudParkPlusDraft/, 'leaving the draft parks source in memory');
assert.match(tabs, /function cloudSwitchToPlusDraft/, 'the parked tab restores from memory');
assert.match(tabs, /cloudPlusDraft && cloudGroupId && groupId !== cloudGroupId/, 'changing group drops the memory slot');
assert.match(tabCss, /\.group-tab:disabled/, 'disabled plus is gray');
assert.match(tabs, /boardAskConfirm/, 'dirty saved tabs use the in-app confirm');
assert.match(tabs, /Not saved yet/, 'tab leave copy is English');
assert.doesNotMatch(tabs, /还没有保存/, 'tab leave copy is not Chinese');
assert.doesNotMatch(tabs, /window\.confirm/, 'tab switch does not use the browser confirm');
assert.match(cloud, /Delete this group\?/, 'history delete copy is English');
assert.doesNotMatch(cloud, /删除这一组/, 'history delete copy is not Chinese');
assert.match(tabs, /cloudParkDirtyBoard/, 'confirming a switch parks dirty source');
assert.match(tabs, /cloudPlusDraftActive\) return true/, 'parking a draft does not prompt');
assert.match(cloud, /boardAskConfirm/, 'history delete uses the in-app confirm');
assert.match(cloud, /function cloudParkDirtyBoard/, 'dirty boards can be parked in memory');
assert.match(tabs, /isShareGuest/, 'share guests do not see group tabs');
assert.match(cloud, /joinGroupId = cloudPlusDraftActive && cloudGroupId \? cloudGroupId : null/);
assert.match(cloud, /p_group_id:\s*joinGroupId/);
assert.match(cloud, /cloudPlusDraftActive && !opts\.explicit/, 'plus draft does not autosave');
assert.match(tabs, /function cloudOpenBoardById/, 'tab switch loads one board id');
assert.match(tabs, /cloudSetBoardHash\(id, true\)/, 'tab switch replaces the hash without hashchange');
assert.match(tabs, /loadCloudBoardByHash/, 'tab switch does not wait for hashchange bootstrap');
assert.match(cloud, /cloudParkPlusDraft/, '#b: load parks an active draft instead of dropping it');
assert.match(cloud, /cloudKnownGroupBoard/, 'known group members skip a second group list fetch');
assert.match(cloud, /refreshCloudGroupMembers/, '#b: first open still refreshes group tabs');
assert.match(cloud, /if \(!known\) void refreshCloudBoardHistory/, 'sibling switch does not refresh history');
assert.match(cloud, /function cloudCachePut/, 'visited boards stay in a memory cache');
assert.match(cloud, /if \(cached\)/, 'a cached board skips the boards query');
assert.match(cloud, /cloudForgetBoardCache/, 'sign out and group delete drop the memory cache');
assert.match(cloud, /async function deleteCloudGroup/, 'history × deletes a group');
assert.doesNotMatch(cloud, /history-group-members/, 'history lists groups, not member boards');
assert.match(boardJs, /cloudPlusDraftActive[\s\S]*saveBoardToHash/, 'plus draft edits persist in #z:');
assert.match(boot, /!cloudPlusDraftActive/, 'hashchange does not flush an active plus draft');

{
  const start = tabs.indexOf('function sortBoardRowsByCreatedAt');
  const end = tabs.indexOf('function cloudGroupTabsVisible');
  assert.ok(start >= 0 && end > start, 'sort helpers are a closed block');
  const helpers = new Function(tabs.slice(start, end) + '\nreturn { sortBoardRowsByCreatedAt, cloudMembersInclude };')();
  const sorted = helpers.sortBoardRowsByCreatedAt([
    { board_id: 'b_22222222', created_at: '2026-10-04T12:00:00Z' },
    { board_id: 'b_11111111', created_at: '2026-10-04T10:00:00Z' },
  ]);
  assert.deepStrictEqual(sorted.map((row) => row.board_id), ['b_11111111', 'b_22222222']);
  const members = [{ board_id: 'b_11111111' }, { board_id: 'b_22222222' }];
  assert.strictEqual(helpers.cloudMembersInclude('b_22222222', 'g_aaaaaaaa', members), true);
  assert.strictEqual(helpers.cloudMembersInclude('b_33333333', 'g_aaaaaaaa', members), false);
  assert.strictEqual(helpers.cloudMembersInclude('b_22222222', '', members), false);
}

console.log('ok cloud-group-tabs');
