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
const boardJs = read('packages/drawer-app/js/02-diagram.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');

assert.match(html, /id="diagram-group-tabs"/, 'canvas keeps a group tab strip');
assert.match(appBuild, /06-cloud-group-tabs\.js/, 'drawer app concatenates group tab chrome');
assert.match(appBuild, /06-confirm\.js/, 'drawer app concatenates the in-app confirm');
assert.match(html, /id="confirmDialog"/, 'canvas keeps one in-app confirm');
assert.match(chromeCss, /\.zoom-float \{[\s\S]*left: 50%;/, 'zoom / type sit at the bottom center');
assert.match(html, /id="zoom-kind-label"/, 'zoom chrome shows the diagram type');
assert.doesNotMatch(html, /id="btnFit"/, 'zoom chrome has no Fit button');
assert.match(chromeCss, /show-chrome \.zoom-float/, 'zoom chrome still appears after a zoom change');
assert.doesNotMatch(tabCss, /right: 88px/, 'group tabs do not shove zoom left');
assert.doesNotMatch(dockCss, /\.zoom-float \{ right: 88px/, 'dock css does not shove zoom left');
assert.match(tabCss, /\.group-tab-float/, 'group tabs are canvas chrome');
assert.match(tabCss, /flex-direction: column/, 'group tabs stack vertically');
assert.match(tabCss, /z-index: 4/, 'open dock covers the tab strip');
assert.match(tabs, /cloudStartPlusDraft/, 'plus starts a local draft');
assert.match(tabs, /openCreateKindDialog/, 'plus opens the kind dialog before writing');
assert.match(tabs, /shellCloseDrawer/, 'picking a type from plus closes the left drawer');
assert.match(tabs, /blankHashFlowchartSource\("Untitled"\)/, 'plus can seed flowchart');
assert.match(tabs, /blankHashMindmapSource\("Untitled"\)/, 'plus can seed mindmap');
assert.match(tabs, /onCancel: function \(\) \{\}/, 'plus cancel does not create a draft');
assert.match(tabs, /saveDiagramToHash/, 'plus writes a blank #z: envelope');
assert.match(tabs, /cloudGroupMembers\.length \+ 1/, 'plus shows the next numbered tab');
assert.match(tabs, /plus\.disabled = !!cloudPlusDraft/, 'plus stays disabled until the draft is saved');
assert.match(tabs, /function cloudParkPlusDraft/, 'leaving the draft parks source in memory');
assert.match(tabs, /function cloudSwitchToPlusDraft/, 'the parked tab restores from memory');
assert.match(tabs, /cloudPlusDraft && cloudGroupId && groupId !== cloudGroupId/, 'changing group drops the memory slot');
assert.match(tabCss, /\.group-tab:disabled/, 'disabled plus is gray');
assert.match(tabs, /askConfirm/, 'dirty saved tabs use the in-app confirm');
assert.match(tabs, /Not saved yet/, 'tab leave copy is English');
assert.doesNotMatch(tabs, /还没有保存/, 'tab leave copy is not Chinese');
assert.doesNotMatch(tabs, /window\.confirm/, 'tab switch does not use the browser confirm');
assert.match(cloud, /Delete this group\?/, 'history delete copy is English');
assert.doesNotMatch(cloud, /删除这一组/, 'history delete copy is not Chinese');
assert.match(tabs, /cloudParkDirtyDiagram/, 'confirming a switch parks dirty source');
assert.match(tabs, /cloudPlusDraftActive\) return true/, 'parking a draft does not prompt');
assert.match(cloud, /askConfirm/, 'history delete uses the in-app confirm');
assert.match(cloud, /function cloudParkDirtyDiagram/, 'dirty boards can be parked in memory');
assert.match(tabs, /isShareGuest/, 'share guests do not see group tabs');
assert.match(cloud, /joinGroupId = cloudPlusDraftActive && cloudGroupId \? cloudGroupId : null/);
assert.match(cloud, /p_group_id:\s*joinGroupId/);
assert.match(cloud, /cloudPlusDraftActive && !opts\.explicit/, 'plus draft does not autosave');
assert.match(tabs, /function cloudOpenDiagramById/, 'tab switch loads one board id');
assert.match(tabs, /cloudSetDiagramHash\(id, true\)/, 'tab switch replaces the hash without hashchange');
assert.match(tabs, /loadCloudDiagramByHash/, 'tab switch does not wait for hashchange bootstrap');
assert.match(cloud, /cloudParkPlusDraft/, '#b: load parks an active draft instead of dropping it');
assert.match(cloud, /cloudKnownGroupDiagram/, 'known group members skip a second group list fetch');
assert.match(cloud, /refreshCloudGroupMembers/, '#b: first open still refreshes group tabs');
assert.match(cloud, /if \(!known\) void cloudRefreshGroups/, 'sibling switch does not refresh history');
assert.match(cloud, /function cloudCachePut/, 'visited boards stay in a memory cache');
assert.match(cloud, /if \(cached\)/, 'a cached board skips the boards query');
assert.match(cloud, /cloudForgetDiagramCache/, 'sign out and group delete drop the memory cache');
assert.match(cloud, /async function deleteCloudGroup/, 'history × deletes a group');
assert.doesNotMatch(cloud, /history-group-members/, 'history lists groups, not member boards');
assert.match(boardJs, /cloudPlusDraftActive[\s\S]*saveDiagramToHash/, 'plus draft edits persist in #z:');
assert.match(boot, /!cloudPlusDraftActive/, 'hashchange does not flush an active plus draft');

{
  const start = tabs.indexOf('function sortDiagramRowsByGroupOrder');
  const end = tabs.indexOf('function cloudGroupTabsVisible');
  assert.ok(start >= 0 && end > start, 'sort helpers are a closed block');
  const helpers = new Function(tabs.slice(start, end) + '\nreturn { sortDiagramRowsByGroupOrder, cloudMembersInclude };')();
  const sorted = helpers.sortDiagramRowsByGroupOrder(
    [{ graph_id: 'b_11111111' }, { graph_id: 'b_22222222' }, { graph_id: 'b_33333333' }],
    [
      { graph_id: 'b_11111111', sort_order: 3 },
      { graph_id: 'b_22222222', sort_order: 1 },
      { graph_id: 'b_33333333', sort_order: 2 },
    ]
  );
  assert.deepStrictEqual(sorted.map((row) => row.graph_id), ['b_22222222', 'b_33333333', 'b_11111111']);
  const tied = helpers.sortDiagramRowsByGroupOrder(
    [{ graph_id: 'b_bbbbbbbb' }, { graph_id: 'b_aaaaaaaa' }],
    [{ graph_id: 'b_bbbbbbbb', sort_order: 1 }, { graph_id: 'b_aaaaaaaa', sort_order: 1 }]
  );
  assert.deepStrictEqual(tied.map((row) => row.graph_id), ['b_aaaaaaaa', 'b_bbbbbbbb'], 'ties break by graph_id');
  const members = [{ graph_id: 'b_11111111' }, { graph_id: 'b_22222222' }];
  assert.strictEqual(helpers.cloudMembersInclude('b_22222222', 'g_aaaaaaaa', members), true);
  assert.strictEqual(helpers.cloudMembersInclude('b_33333333', 'g_aaaaaaaa', members), false);
  assert.strictEqual(helpers.cloudMembersInclude('b_22222222', '', members), false);
  assert.match(tabs, /select\("graph_id,group_id,sort_order,title"\)/, 'tabs read the stored order and title');
  assert.doesNotMatch(tabs, /created_at/, 'tabs no longer sort by created_at');
}

assert.match(tabs, /from\("graphs"\)\.select\("graph_id,group_id,sort_order,title"\)/, 'tabs read group, order and title from boards');
assert.strictEqual((tabs.match(/cloudClient\.from\("graphs"\)/g) || []).length, 1, 'one boards query feeds the tabs');
assert.doesNotMatch(tabs, /\.title = /, 'number tabs drop the slow native title');
assert.match(tabs, /bindGroupTabTip\(btn, relabel\)/, 'number tabs show the self-drawn tip');
assert.match(tabs, /function bindGroupTabTip\(btn, label\) \{\n  bindChromeTip\(btn, label, function \(\) \{ return btn\.parentElement; \}\);/, 'tab tip is the shared chrome tip, 6px off the strip');
assert.match(tabCss, /\.chrome-tip \{[\s\S]*pointer-events: none/, 'tip never steals the pointer');
assert.match(tabCss, /\.chrome-tip \{[\s\S]*display: block;[\s\S]*text-overflow: ellipsis/, 'tip is a block box so the ellipsis renders');
assert.match(tabCss, /prefers-reduced-motion/, 'tip honors reduced motion');
assert.match(tabs, /"Board " \+ number \+ ": " \+ t\)/, 'aria-label is Board N: <title>');
assert.match(tabs, /getDiagramTitle\(row\.graph_id, row\.title\)/, 'tabs take the title only from getDiagramTitle');
assert.match(tabs, /addEventListener\("mouseenter", show\)/, 'title is re-read on hover');
assert.match(tabs, /addEventListener\("focus", show\)/, 'title is re-read on focus');
assert.match(tabs, /bindGroupTabTip\(draft, function \(\) \{ return "Untitled"; \}\)/, 'unsaved draft tab hovers Untitled');
assert.match(tabs, /"Add diagram"/, 'plus keeps Add diagram');
{
  const sync = fs.readFileSync(path.join(root, 'packages/drawer-app/js/06-cloud-sync.js'), 'utf8');
  const start = sync.indexOf('function cloudOpenDiagramId');
  const end = sync.indexOf('function cloudSetDiagramHash');
  assert.ok(start > 0 && end > start, 'getDiagramTitle lives in 06-cloud-sync');
  const body = sync.slice(start, end);
  assert.match(body, /cloudDiagramTitle\(source\)/, 'reuses the existing md title parser');
  const make = (env) => new Function('cloudPlusDraftActive', 'cloudDiagramId', 'diagramSourceEl', 'cloudCachedDiagramRow', 'cloudDiagramTitle',
    body + '\nreturn getDiagramTitle;')(!!env.draft, () => env.current || '', env.el || null,
    (id) => (env.cache || {})[id] || null,
    (src) => { const m = /^\s*board\s+"([^"]*)"/.exec(String(src || '')); return m ? m[1] : ''; });
  const el = { value: 'board "Live"\n' };
  const get = make({ current: 'b_1', el, cache: { b_1: { bmd: 'board "Saved"' }, b_2: { bmd: 'board "Cached"\n', title: 'Old' } } });
  assert.strictEqual(get('b_1', 'Q'), 'Live', 'open board follows the live md');
  el.value = 'board "Renamed"\n';
  assert.strictEqual(get('b_1', 'Q'), 'Renamed', 'unsaved rename shows at once');
  assert.strictEqual(get('b_2', 'Q'), 'Cached', 'loaded board follows cached md, not its stored title');
  assert.strictEqual(get('b_3', 'Queried'), 'Queried', 'unloaded board uses the queried title');
  assert.strictEqual(get('b_3', ''), 'Untitled', 'empty → Untitled');
  el.value = 'item a\n';
  assert.strictEqual(get('b_1', 'Q'), 'Untitled', 'md without a title line → Untitled');
  const draft = make({ draft: true, current: 'b_1', el, cache: { b_1: { bmd: 'board "Saved"' } } });
  assert.strictEqual(draft('b_1', 'Q'), 'Saved', 'while on the draft, member reads its cached md');
  el.value = 'board "Draft title"\n';
  assert.strictEqual(draft(''), 'Draft title', 'open board without a cloud id reads the editor md');
  const local = make({ current: '', el: { value: 'board "Local real"\n' } });
  assert.strictEqual(local(''), 'Local real', 'local server mode (no id) keeps the real md title, not Untitled');
}
assert.doesNotMatch(tabs, /group_members/, 'tabs no longer read group_members');
console.log('ok cloud-group-tabs');
