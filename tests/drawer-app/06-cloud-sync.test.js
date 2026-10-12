'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const migrationsDir = path.join(root, '../lulu-dev-skills/docs/archive/lulu-board/supabase/migrations');
const hasSql = fs.existsSync(migrationsDir);
// The migration SQL lives outside this repo; without it only the SQL-text checks are skipped.
if (!hasSql) console.warn('skip SQL checks: ' + migrationsDir + ' not found');
const readSql = (name) => (hasSql ? fs.readFileSync(path.join(migrationsDir, name), 'utf8') : '');
const sqlAssert = hasSql ? assert : { match() {}, doesNotMatch() {} };

const html = read('packages/drawer-app/index.html');
const appBuild = read('scripts/drawer-app-build/build.mjs');
const shareJs = read('packages/drawer-app/js/06-cloud-share.js');
const shareCss = read('packages/drawer-app/css/05-share.css');
const dockCss = read('packages/drawer-app/css/03-diagram.css');
const webBuild = read('scripts/web-build/build.mjs');
const cloud = read('packages/drawer-app/js/06-cloud-sync.js');
const boardJs = read('packages/drawer-app/js/02-board.js');
const schema = readSql('20260917160000_create_boards.sql');
const versionSql = readSql('20260918090000_boards_version.sql');
const shareSql = readSql('20260918142200_board_share.sql');
const shareRoleSql = readSql('20260918143300_share_access_role.sql');
const workerConfig = read('wrangler.toml');

assert.match(html, /Content-Security-Policy/, 'public page declares a CSP');
assert.match(html, /img-src[^"]*https:\/\/\*\.googleusercontent\.com/, 'CSP allows Google avatars');
assert.match(html, /img-src[^"]*https:\/\/avatars\.githubusercontent\.com/, 'CSP allows GitHub avatars');
assert.match(html, /id="btnBoardSignIn"/, 'public page exposes sign in');
assert.match(html, /id="boardSignInDialog"/, 'unsigned #b: has a sign-in dialog');
assert.match(html, /Sign in to open this board/, 'dialog copy asks to sign in');
assert.match(html, /id="btnBoardSignInClose"/, 'dialog can be dismissed');
assert.match(html, /id="btnBoardAccount"/, 'signed-in account is a menu button');
assert.match(html, /id="boardSessionMenu"/, 'account menu holds session actions');
assert.match(html, /id="btnBoardSaveCloud"/, 'unsaved chrome stays with the account cluster');
assert.match(html, /id="boardAccount"[\s\S]*id="btnBoardSignIn"/, 'Sign in lives in the account cluster');
assert.match(html, /id="shellMineList"/, 'signed-in groups are listed in the left drawer');
assert.match(html, /id="btnDockProps"[\s\S]*id="btnDockStyle"[\s\S]*id="btnDockSource"[\s\S]*id="btnDockExport"[\s\S]*id="btnBoardOnboarding"/, 'Source is dock tab 3, Export is tab 4');
assert.doesNotMatch(html, /id="btnDockShare"|id="sharePanel"|data-dock-panel="share"/, 'Share left the right dock for the left drawer');
assert.doesNotMatch(dockCss, /data-open="share"/, 'no dock width rule for a Share tab');
assert.match(html, /id="shellShareBoard"/, 'the drawer has a Share this board button');
assert.match(html, /id="shellSharedList"/, 'the drawer lists the boards you shared');
assert.doesNotMatch(shareCss, /\.share-role-seg|#sharePanel/, 'panel styles are gone');
assert.doesNotMatch(html, /id="btnBoardShare"/, 'share left the toolbar');
assert.match(html, /id="btnBoardSaveCopy"/, 'shared viewers can save a copy');
assert.match(html, /id="btnShareSync"/, 'share guests with edit access get Share sync');
assert.match(appBuild, /06-cloud-share\.js/, 'drawer app concatenates the share module');
assert.match(appBuild, /06-cloud-group-tabs\.js/, 'drawer app concatenates group tab chrome');
assert.match(html, /id="board-group-tabs"/, 'canvas keeps a group tab strip');
assert.doesNotMatch(dockCss, /\.zoom-float \{ right: 88px/, 'zoom / Fit no longer sit over group tabs');
assert.match(shareJs, /rpc\("get_shared_board"/, 'shared read uses get_shared_board');
assert.match(shareJs, /p_board_id: boardId/, 'share mutations pass the cloud board id');
assert.match(read('packages/drawer-app/js/06-cloud-shares.js') + read('packages/drawer-app/js/09-shell-drawer.js'), /set_share_role/, 'owner access uses set_share_role');
assert.match(shareJs, /save_shared_board/, 'shared editors save through save_shared_board');
assert.match(shareJs, /function syncSharedOriginal/, 'Share sync writes the original row');
assert.match(shareJs, /shareSync.hidden = !\(signedIn && isShareEdit\(\)\)/, 'Share sync needs a signed-in editor');
assert.match(shareJs, /function loadSharedBoardByHash/, 'hash bootstrap can load a share token');
assert.match(shareJs, /showBoardError\(message\)/, 'a missing share token surfaces an error');
assert.doesNotMatch(shareJs, /from\("boards"\)/, 'share module does not select boards as anon');
assert.match(read('packages/drawer-app/js/09-shell-drawer.js'), /isShareGuest\(\)\) && \w|isShareGuest/, 'guests cannot use Share this board');
assert.doesNotMatch(boardJs, /dataset\.shareView === "on"\) return/, 'share view still lets the guest edit locally');
assert.doesNotMatch(boardJs, /saveSharedBoard\(\{ explicit: false \}\)/, 'autosave does not write the shared original');
{
  const start = boardJs.indexOf('async function saveBoardToFile');
  const guest = boardJs.slice(start, boardJs.indexOf('if (typeof cloudBoardId', start));
  assert.match(guest, /isShareGuest\(\)/, 'hash persist sees share guests');
  assert.match(guest, /return Promise\.resolve\(\)/, 'share guests stay in memory');
  assert.doesNotMatch(guest, /forkSharedBoard|saveSharedBoard/, 'autosave does not create a share copy');
}
assert.match(cloud, /cloudSaveUncreated\(signedIn, ownCloud\)/, 'signed-in #z: and #s: keep Saved clickable');
assert.match(cloud, /if \(!ownCloud && typeof liveBoardId/, 'Saved chrome follows the created row before the hash flips');
assert.match(cloud, /save\.title = "Not created"/, 'uncreated Saved hints Not created');
{
  const block = dockCss.match(/\.board-cloud-status\.is-pending\.is-uncreated \{[^}]+\}/);
  assert.ok(block, 'uncreated Saved has a pending rule');
  assert.match(block[0], /color:\s*var\(--muted/, 'uncreated Saved uses the muted icon');
}
assert.match(dockCss, /\.board-cloud-status\.is-pending \{[\s\S]*?color:\s*var\(--warn\)/, 'unsaved Saved uses the warn icon');
assert.match(dockCss, /\.board-cloud-status\.is-current \{[\s\S]*?color:\s*var\(--ok\)/, 'synced Saved uses the ok icon');
assert.match(html, /class="board-cloud-status-icon"/, 'Saved chrome is an icon');
assert.match(cloud, /isShareGuest[\s\S]*forkSharedBoard/, 'Saved on a share creates the guest\'s own copy');
assert.match(html, /id="boardCloudStatus"/, 'aligned save state is a status chip');
assert.match(html, /board-cloud-status is-pending/, 'unsaved chrome uses the pending status chip');
assert.match(cloud, /function syncCloudSaveChrome/, 'save chrome follows server and client versions');
assert.match(cloud, /copy\.pending/, 'unsaved chrome keeps the pending chip');
assert.match(boardJs, /cloudBoardId\(\) \? 3000 : 350/, 'cloud autosave waits 3s');
assert.match(html, /id="btnBoardSignOut"[\s\S]*boardSessionMenu|id="boardSessionMenu"[\s\S]*id="btnBoardSignOut"/, 'Sign out lives in the account menu');
assert.match(html, /data-board-oauth="google"/, 'Google is an available provider');
assert.match(html, /data-board-oauth="github"/, 'GitHub is an available provider');
assert.match(html, /supabase-config\.js/, 'public page loads runtime Supabase configuration');
assert.match(html, /supabase-client\.js/, 'public page loads the local Supabase client bundle');
assert.match(appBuild, /@supabase\/supabase-js/, 'build bundles the Supabase client locally');
assert.match(appBuild, /\.cache\/web/, 'drawer app output is temporary cached web assets');
assert.match(webBuild, /supabase-config\.js/, 'public site build verifies the configuration asset');
assert.match(webBuild, /supabase-client\.js/, 'public site build verifies the client asset');
assert.match(webBuild, /\.cache\/web/, 'public site output is temporary cached web assets');
assert.match(workerConfig, /name = "lulu-board"/, 'Workers Builds deploys the existing Worker');
assert.match(workerConfig, /directory = "\.\/\.cache\/web\/"/, 'Worker deploys the generated cache directory');
assert.match(cloud, /rpc\("create_owned_board_with_group"/, 'first insert writes board, group, and membership together');
assert.match(cloud, /\.eq\("version", expected\)/, 'updates CAS on the server version');
assert.match(cloud, /\.update\([\s\S]*\.select\("board_id,title,bmd,version,share_id,updated_at"\)/, 'update returns the saved source');
assert.match(cloud, /\.select\("board_id,title,bmd,version,share_id,created_at,updated_at"\)/, 'owner load also reads share_id');
assert.doesNotMatch(cloud, /onConflict/, 'cloud saves do not upsert');
sqlAssert.match(versionSql, /add column if not exists version/, 'version column is added');
sqlAssert.match(versionSql, /new\.version = coalesce\(old\.version, 1\) \+ 1/, 'update increments version');
sqlAssert.match(shareSql, /add column if not exists share_id/, 'share token is a boards column');
sqlAssert.match(shareSql, /create unique index if not exists boards_share_id_key/, 'share_id is globally unique');
sqlAssert.match(shareSql, /create table if not exists public\.grants/, 'grants hang off share_id');
sqlAssert.match(shareSql, /security definer/, 'share API is security-definer');
sqlAssert.match(shareSql, /function public\.open_share/, 'open_share mints the token');
sqlAssert.match(shareSql, /function public\.rotate_share/, 'rotate_share replaces the token');
sqlAssert.match(shareSql, /function public\.unshare/, 'unshare clears grants then share_id');
sqlAssert.match(shareSql, /function public\.get_shared_board/, 'get_shared_board is the only shared read');
sqlAssert.match(shareSql, /grant update \(title, bmd\) on table public\.boards to authenticated/, 'authenticated update is column-limited');
sqlAssert.match(shareSql, /grant insert \(owner_id, board_id, title, bmd\) on table public\.boards to authenticated/, 'clients cannot insert a share token');
sqlAssert.match(shareSql, /grant execute on function public\.get_shared_board\(text\) to anon, authenticated/, 'shared read is an rpc');
sqlAssert.doesNotMatch(shareSql, /grant select[^\n]*anon/, 'anon has no table select on boards');
sqlAssert.match(shareRoleSql, /function public\.set_share_role/, 'owner can change the all grant role');
sqlAssert.match(shareRoleSql, /function public\.own_share_state/, 'owner panel reads the current grant');
sqlAssert.match(shareRoleSql, /function public\.save_shared_board/, 'shared edit writes through rpc');
sqlAssert.match(shareRoleSql, /access text/, 'shared read returns the access role');
sqlAssert.match(shareRoleSql, /grant execute on function public\.save_shared_board/, 'shared edit is authenticated only');
assert.match(cloud, /provider: selected/, 'cloud sign in selects an OAuth provider');
assert.match(cloud, /flowType: "pkce"/, 'OAuth callbacks use query-based PKCE, not a token fragment');
assert.match(cloud, /cloudRefreshGroups/, 'the drawer group list is loaded from Supabase');
assert.match(cloud, /function cloudAccountProfile/, 'account chrome reads the OAuth profile');
assert.match(cloud, /function cloudCloseAccountMenus/, 'account menus share one close path');
assert.match(cloud, /function cloudShowSignInDialog/, 'unsigned cloud hash opens the dialog');
assert.match(cloud, /cloudShowSignInDialog\(\)/, 'unsigned #b: load shows the dialog');
assert.match(cloud, /if \(signedIn\) cloudHideSignInDialog/, 'signed-in chrome closes the dialog');
assert.match(cloud, /function cloudDeclineCloudBoard/, 'Not now leaves the cloud pointer');
assert.match(cloud, /btnBoardSignInClose[\s\S]*cloudDeclineCloudBoard/, 'Not now resets the URL off #b:');
assert.match(cloud, /async function cloudDeclineCloudBoard[\s\S]*bootstrapBoardFromHash/, 'declining seeds an unsigned #z: board');
assert.doesNotMatch(shareJs, /cloudShowSignInDialog/, 'share links do not force sign-in');

{
  const start = cloud.indexOf('function cloudVersionsAligned');
  const end = cloud.indexOf('function syncCloudSaveChrome');
  assert.ok(start >= 0 && end > start, 'cloud save copy helpers are closed functions');
  const helpers = new Function(cloud.slice(start, end) + '\nreturn { cloudVersionsAligned, cloudSaveButtonCopy, cloudSaveUncreated };')();
  assert.strictEqual(helpers.cloudVersionsAligned(5, 5), true);
  assert.strictEqual(helpers.cloudVersionsAligned(5, 6), false);
  assert.strictEqual(helpers.cloudVersionsAligned(0, 1), false);
  assert.strictEqual(helpers.cloudSaveUncreated(true, ""), true);
  assert.strictEqual(helpers.cloudSaveUncreated(true, "b_abc"), false);
  assert.strictEqual(helpers.cloudSaveUncreated(false, ""), false);
  assert.strictEqual(helpers.cloudSaveButtonCopy(false, false).hidden, true);
  assert.deepStrictEqual(helpers.cloudSaveButtonCopy(true, true), {
    hidden: false,
    pending: false,
    current: true,
    label: "Saved",
    title: "Synced",
  });
  assert.deepStrictEqual(helpers.cloudSaveButtonCopy(true, false), {
    hidden: false,
    pending: true,
    current: false,
    label: "Saved",
    title: "Not saved",
  });
}

{
  const start = cloud.indexOf('function cloudRowSource');
  const end = cloud.indexOf('function applyCloudBoardRow');
  assert.ok(start >= 0 && end > start, 'cloudRowSource is a closed function');
  const helpers = new Function(cloud.slice(start, end) + '\nreturn { cloudRowSource };')();
  assert.strictEqual(helpers.cloudRowSource({ version: 2 }, 'board "Keep"\n'), 'board "Keep"\n');
  assert.strictEqual(helpers.cloudRowSource({ bmd: 'board "A"\n' }, 'board "Keep"\n'), 'board "A"\n');
  assert.strictEqual(helpers.cloudRowSource({ bmd: null }, 'board "Keep"\n'), 'board "Keep"\n');
}

{
  const start = cloud.indexOf('function cloudSafeAvatarUrl');
  const end = cloud.indexOf('function cloudCloseAccountMenus');
  assert.ok(start >= 0 && end > start, 'profile helpers are closed functions');
  const helpers = new Function(cloud.slice(start, end) + '\nreturn { cloudSafeAvatarUrl, cloudAccountProfile };')();
  assert.strictEqual(helpers.cloudSafeAvatarUrl('https://lh3.googleusercontent.com/a/foo'), 'https://lh3.googleusercontent.com/a/foo');
  assert.strictEqual(helpers.cloudSafeAvatarUrl('https://avatars.githubusercontent.com/u/1'), 'https://avatars.githubusercontent.com/u/1');
  assert.strictEqual(helpers.cloudSafeAvatarUrl('http://lh3.googleusercontent.com/a/foo'), '');
  const profile = helpers.cloudAccountProfile({
    email: 'namdamlmm@gmail.com',
    user_metadata: { full_name: 'Man Man', avatar_url: 'https://lh3.googleusercontent.com/a/foo' },
  });
  assert.strictEqual(profile.name, 'Man Man');
  assert.strictEqual(profile.initials, 'MM');
  assert.strictEqual(profile.avatarUrl, 'https://lh3.googleusercontent.com/a/foo');
}
sqlAssert.match(schema, /primary key \(owner_id, board_id\)/, 'each owner can hold one latest copy per board id');
sqlAssert.match(schema, /bmd text not null/, 'the current BMD source is stored in Postgres');
sqlAssert.match(schema, /enable row level security/, 'the cloud board table has RLS enabled');
sqlAssert.match(schema, /with check \(\(select auth\.uid\(\)\) = owner_id\)/, 'inserts are owner-scoped');

{
  const start = cloud.indexOf('async function cloudSignOut');
  const end = cloud.indexOf('async function saveBoardToCloud');
  assert.ok(start >= 0 && end > start, 'cloudSignOut is a closed function');
  const body = cloud.slice(start, end);
  assert.match(body, /history\.replaceState/, 'sign-out drops the #b: hash');
  assert.match(body, /bootstrapBoardFromHash/, 'sign-out seeds a blank local board');
  assert.doesNotMatch(body, /cloudClearOpenBoard/, 'sign-out does not empty the source in place');
}

{
  const start = cloud.indexOf('function groupBoardRowsByGroup');
  const sib = cloud.indexOf('function loadSiblingBoardIds');
  const save = cloud.indexOf('async function saveBoardToCloud');
  assert.ok(start >= 0 && sib > start && save > sib, 'group helpers are closed functions');
  const helpers = new Function(
    cloud.slice(start, save) + '\nreturn { groupBoardRowsByGroup, loadSiblingBoardIds };'
  )();
  const a = { board_id: 'b_11111111', title: 'A', updated_at: '2026-10-04T12:00:00Z' };
  const b = { board_id: 'b_22222222', title: 'B', updated_at: '2026-10-04T11:00:00Z' };
  const c = { board_id: 'b_33333333', title: 'C', updated_at: '2026-10-03T10:00:00Z' };
  const memberships = [
    { board_id: 'b_11111111', group_id: 'g_aaaa0001' },
    { board_id: 'b_22222222', group_id: 'g_aaaa0001' },
    { board_id: 'b_33333333', group_id: 'g_bbbb0002' },
  ];
  const grouped = helpers.groupBoardRowsByGroup([a, b, c], memberships);
  assert.strictEqual(grouped.length, 2);
  assert.strictEqual(grouped[0].group_id, 'g_aaaa0001');
  assert.deepStrictEqual(grouped[0].members.map((row) => row.board_id), ['b_11111111', 'b_22222222']);
  assert.strictEqual(grouped[1].members[0].board_id, 'b_33333333');
  const solo = helpers.groupBoardRowsByGroup([c], [memberships[2]]);
  assert.strictEqual(solo.length, 1);
  assert.strictEqual(solo[0].members.length, 1);
  assert.deepStrictEqual(helpers.loadSiblingBoardIds('b_11111111', memberships), ['b_22222222']);
  assert.deepStrictEqual(helpers.loadSiblingBoardIds('b_33333333', [memberships[2]]), []);
}

{
  const groups = fs.readFileSync(path.join(root, 'packages/drawer-app/js/06-cloud-groups.js'), 'utf8');
  assert.match(groups, /from\("group_members"\)/, 'groups load memberships');
  assert.match(groups, /groupBoardRowsByGroup/, 'groups are built by group');
  const refresh = cloud.slice(cloud.indexOf('async function cloudRefreshGroups'), cloud.indexOf('async function deleteCloudGroup'));
  assert.match(refresh, /cloudFetchGroupSummaries/, 'the refresh reads the shared group data');
  assert.match(refresh, /shellRenderMine\(groups\)/, 'the drawer renders each row as a group');
}

{
  const del = cloud.slice(
    cloud.indexOf('async function deleteCloudGroup'),
    cloud.indexOf('(function wireCloudAuth')
  );
  assert.match(del, /from\("boards"\)\.delete\(\)\.in\("board_id"/, 'group delete removes every board');
  assert.match(del, /from\("groups"\)\.delete\(\)\.eq\("group_id"/, 'group delete removes the group row');
}

{
  const load = cloud.slice(
    cloud.indexOf('async function loadCloudBoardByHash'),
    cloud.indexOf('async function cloudRefreshGroups')
  );
  const reject = load.indexOf('if (!boardId) return false');
  const members = load.search(/refreshCloudGroupMembers|from\("group_members"\)|loadSiblingBoardIds/);
  assert.ok(reject >= 0 && members > reject, 'invalid hash returns false and does not query groups');
  assert.match(load, /refreshCloudGroupMembers/, '#b: first open still refreshes group tabs');
  assert.match(load, /cloudKnownGroupBoard/, '#b: known sibling skips the group list');
  assert.match(load, /cloudCachedBoardRow/, '#b: uses an in-memory row when present');
  assert.match(load, /if \(cached\)/, '#b: cache hit does not query boards');
  assert.match(load, /if \(!known\) void cloudRefreshGroups/, 'known sibling skips the group list refresh');
  assert.match(load, /cloudParkPlusDraft/, '#b: parks an active plus draft');
  assert.doesNotMatch(load, /cloudPlusDraft = false/, '#b: load keeps the parked plus draft');
  assert.match(load, /from\("boards"\)[\s\S]*maybeSingle/, '#b: still opens one boards row');
  assert.doesNotMatch(load, /location\.hash\s*=/, '#b: open does not rewrite the hash');
  assert.doesNotMatch(load, /from\("groups"\)/, 'sibling load uses membership, not groups');
  assert.doesNotMatch(load, /open_share|rotate_share|set_share_role|save_shared_board/);
}

{
  const start = cloud.indexOf('function cloudCachePut');
  const end = cloud.indexOf('function cloudRememberBoardRow');
  assert.ok(start >= 0 && end > start, 'cloudCachePut is a closed helper');
  const helpers = new Function(cloud.slice(start, end) + '\nreturn { cloudCachePut, cloudCacheGet };')();
  const store = {};
  helpers.cloudCachePut(store, { board_id: 'b_11111111', title: 'One', bmd: 'board "One"\n', version: 2, dirty: true, localRev: 3 });
  assert.strictEqual(helpers.cloudCacheGet(store, 'b_11111111').bmd, 'board "One"\n');
  assert.strictEqual(helpers.cloudCacheGet(store, 'b_11111111').dirty, true);
  assert.strictEqual(helpers.cloudCacheGet(store, 'b_22222222'), null);
}

{
  const save = cloud.slice(
    cloud.indexOf('async function saveBoardToCloud'),
    cloud.indexOf('async function loadCloudBoardByHash')
  );
  const minted = save.indexOf('if (!boardId)');
  const updated = save.indexOf('} else {');
  assert.ok(minted >= 0 && updated > minted);
  const insertBranch = save.slice(minted, updated);
  const updateBranch = save.slice(updated);
  assert.match(insertBranch, /rpc\("create_owned_board_with_group"/);
  assert.match(insertBranch, /p_board_id:\s*boardId/);
  assert.match(insertBranch, /joinGroupId = cloudPlusDraftActive && cloudGroupId \? cloudGroupId : null/);
  assert.match(insertBranch, /p_group_id:\s*joinGroupId/);
  assert.match(save, /cloudPlusDraftActive && !opts\.explicit/, 'plus draft does not autosave');
  assert.doesNotMatch(insertBranch, /from\("boards"\)\.insert|from\("group_members"\)/);
  assert.match(insertBranch, /cloudSetBoardHash\(boardId/);
  assert.match(updateBranch, /\.update\(\{\s*title:\s*title,\s*bmd:\s*source,/);
  assert.doesNotMatch(updateBranch, /create_owned_board_with_group|from\("group_members"\)/);
  assert.doesNotMatch(updateBranch, /share_id\s*:/);
  assert.doesNotMatch(save, /from\("boards"\)\.(insert|update)\([\s\S]*group_id/);
}

{
  const tabs = read('packages/drawer-app/js/06-cloud-group-tabs.js');
  const tabCss = read('packages/drawer-app/css/06-group-tabs.css');
  const start = tabs.indexOf('function sortBoardRowsByGroupOrder');
  const end = tabs.indexOf('function cloudGroupTabsVisible');
  assert.ok(start >= 0 && end > start, 'sortBoardRowsByGroupOrder is a closed function');
  const helpers = new Function(tabs.slice(start, end) + '\nreturn { sortBoardRowsByGroupOrder };')();
  const sorted = helpers.sortBoardRowsByGroupOrder(
    [{ board_id: 'b_22222222' }, { board_id: 'b_11111111' }],
    [{ board_id: 'b_22222222', sort_order: 2 }, { board_id: 'b_11111111', sort_order: 1 }]
  );
  assert.deepStrictEqual(sorted.map((row) => row.board_id), ['b_11111111', 'b_22222222']);
  assert.match(tabs, /cloudStartPlusDraft/, 'plus starts a local draft');
  assert.match(tabs, /boardAskConfirm/, 'dirty saved tabs use the in-app confirm');
  assert.match(tabs, /isShareGuest/, 'share guests do not see group tabs');
  assert.match(tabCss, /\.group-tab-float/, 'group tabs are canvas chrome');
  assert.match(tabCss, /flex-direction: column/, 'group tabs stack vertically');
  assert.match(tabCss, /z-index: 4/, 'open dock covers the tab strip');
}

console.log('ok cloud-sync');
