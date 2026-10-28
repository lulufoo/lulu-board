import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
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
const appBuild = read('scripts/build-app/drawer.mjs');
const shareJs = read('packages/drawer-app/src/cloud/cloud-share.js');
const shareCss = read('packages/drawer-app/css/05-share.css');
const dockCss = read('packages/drawer-app/css/03-diagram.css');
const webBuild = read('scripts/build-web/build.mjs');
const cloud = read('packages/drawer-app/src/cloud/cloud-sync.js');
const boardJs = read('packages/drawer-app/src/kinds/diagram.js');
const schema = readSql('20260917160000_create_boards.sql');
const versionSql = readSql('20260918090000_boards_version.sql');
const shareSql = readSql('20260918142200_board_share.sql');
const shareRoleSql = readSql('20260918143300_share_access_role.sql');
const workerConfig = read('wrangler.toml');

assert.match(html, /Content-Security-Policy/, 'public page declares a CSP');
assert.match(html, /connect-src[^"]*https:\/\/api\.luluboard\.app/, 'first cloud save may call the board API');
assert.match(html, /img-src[^"]*https:\/\/\*\.googleusercontent\.com/, 'CSP allows Google avatars');
assert.match(html, /img-src[^"]*https:\/\/avatars\.githubusercontent\.com/, 'CSP allows GitHub avatars');
assert.match(html, /id="btnShellSignIn"/, 'public page exposes sign in');
assert.match(html, /id="shellSignInDialog"/, 'unsigned #b: has a sign-in dialog');
assert.match(html, /Sign in to open this diagram/, 'dialog copy asks to sign in');
assert.match(html, /id="btnShellSignInClose"/, 'dialog can be dismissed');
assert.match(html, /id="btnShellSession"/, 'signed-in account is a menu button');
assert.match(html, /id="shellSessionMenu"/, 'account menu holds session actions');
assert.match(html, /id="btnShellSaveCloud"/, 'unsaved chrome stays with the account cluster');
assert.match(html, /id="shellAccount"[\s\S]*id="btnShellSignIn"/, 'Sign in lives in the account cluster');
assert.match(html, /id="shellMineList"/, 'signed-in groups are listed in the left drawer');
assert.match(html, /id="btnDockProps"[\s\S]*id="btnDockStyle"[\s\S]*id="btnDockSource"[\s\S]*id="btnDockExport"[\s\S]*id="btnDiagramHelp"/, 'Source is dock tab 3, Export is tab 4');
assert.doesNotMatch(html, /id="btnDockShare"|id="sharePanel"|data-dock-panel="share"/, 'Share left the right dock for the left drawer');
assert.doesNotMatch(dockCss, /data-open="share"/, 'no dock width rule for a Share tab');
assert.match(html, /id="shellShareDiagram"/, 'the drawer has a Share this board button');
assert.match(html, /id="shellSharedList"/, 'the drawer lists the boards you shared');
assert.doesNotMatch(shareCss, /\.share-role-seg|#sharePanel/, 'panel styles are gone');
assert.doesNotMatch(html, /id="btnBoardShare"/, 'share left the toolbar');
assert.match(html, /id="btnShellSaveCopy"/, 'shared viewers can save a copy');
assert.match(html, /id="btnShareSync"/, 'share guests with edit access get Share sync');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-share.js')), 'drawer app concatenates the share module');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-group-tabs.js')), 'drawer app concatenates group tab chrome');
assert.match(html, /id="diagram-group-tabs"/, 'canvas keeps a group tab strip');
assert.doesNotMatch(dockCss, /\.zoom-float \{ right: 88px/, 'zoom / Fit no longer sit over group tabs');
assert.match(shareJs, /rpc\("get_shared_graph"/, 'shared read uses get_shared_graph');
assert.match(shareJs, /p_graph_id: diagramId/, 'share mutations pass the cloud board id');
assert.match(read('packages/drawer-app/src/cloud/cloud-shares.js') + read('packages/drawer-app/src/chrome/shell-drawer.js') + read('packages/drawer-app/src/chrome/share-dialog.js'), /set_share_role/, 'owner access uses set_share_role');
assert.match(shareJs, /https:\/\/api\.luluboard\.app\/shares/, 'shared editors save through the board API');
assert.doesNotMatch(shareJs, /save_shared_graph/, 'shared editors do not call the SQL function');
assert.match(shareJs, /function syncSharedOriginal/, 'Share sync writes the original row');
assert.match(shareJs, /shareSync.hidden = !\(signedIn && isShareEdit\(\)\)/, 'Share sync needs a signed-in editor');
assert.match(shareJs, /function loadSharedDiagramByHash/, 'hash bootstrap can load a share token');
assert.match(shareJs, /showDiagramError\(message\)/, 'a missing share token surfaces an error');
assert.doesNotMatch(shareJs, /from\("graphs"\)/, 'share module does not select boards as anon');
assert.match(read('packages/drawer-app/src/chrome/shell-drawer.js'), /isShareGuest\(\)\) && \w|isShareGuest/, 'guests cannot use Share this board');
assert.doesNotMatch(boardJs, /dataset\.shareView === "on"\) return/, 'share view still lets the guest edit locally');
assert.doesNotMatch(boardJs, /saveSharedDiagram\(\{ explicit: false \}\)/, 'autosave does not write the shared original');
{
  const start = boardJs.indexOf('async function saveDiagramToFile');
  const guest = boardJs.slice(start, boardJs.indexOf('if (call("cloudDiagramId"', start));
  assert.match(guest, /call\("isShareGuest"\)/, 'hash persist sees share guests');
  assert.match(guest, /return Promise\.resolve\(\)/, 'share guests stay in memory');
  assert.doesNotMatch(guest, /forkSharedDiagram|saveSharedDiagram/, 'autosave does not create a share copy');
}
assert.match(cloud, /cloudSaveUncreated\(signedIn, ownCloud\)/, 'signed-in #z: and #s: keep Saved clickable');
assert.match(cloud, /if \(!ownCloud && typeof liveDiagramId/, 'Saved chrome follows the created row before the hash flips');
assert.match(cloud, /cloudSetActionLabel\(save, "Create"\)/, 'uncreated Saved hints Create');
assert.doesNotMatch(cloud, /save\.title =|status\.title =/, 'save chrome drops the native title');
{
  const block = dockCss.match(/\.shell-cloud-status\.is-pending\.is-uncreated \{[^}]+\}/);
  assert.ok(block, 'uncreated Saved has a pending rule');
  assert.match(block[0], /color:\s*var\(--muted/, 'uncreated Saved uses the muted icon');
}
assert.match(dockCss, /\.shell-cloud-status\.is-pending \{[\s\S]*?color:\s*var\(--warn\)/, 'unsaved Saved uses the warn icon');
assert.match(dockCss, /\.shell-cloud-status\.is-current \{[\s\S]*?color:\s*var\(--ok\)/, 'synced Saved uses the ok icon');
assert.match(html, /class="shell-cloud-status-icon"/, 'Saved chrome is an icon');
assert.match(cloud, /isShareGuest[\s\S]*forkSharedDiagram/, 'Saved on a share creates the guest\'s own copy');
assert.match(html, /id="shellCloudStatus"/, 'aligned save state is a status chip');
assert.match(html, /shell-cloud-status is-pending/, 'unsaved chrome uses the pending status chip');
assert.match(cloud, /function syncCloudSaveChrome/, 'save chrome follows server and client versions');
assert.match(cloud, /copy\.pending/, 'unsaved chrome keeps the pending chip');
assert.match(boardJs, /call\("cloudDiagramId"\) \? 3000 : 350/, 'cloud autosave waits 3s');
assert.match(html, /id="btnShellSessionOut"[\s\S]*shellSessionMenu|id="shellSessionMenu"[\s\S]*id="btnShellSessionOut"/, 'Sign out lives in the account menu');
assert.match(html, /data-shell-oauth="google"/, 'Google is an available provider');
assert.match(html, /data-shell-oauth="github"/, 'GitHub is an available provider');
assert.match(html, /supabase-config\.js/, 'public page loads runtime Supabase configuration');
assert.match(html, /supabase-client\.js/, 'public page loads the local Supabase client bundle');
assert.match(appBuild, /@supabase\/supabase-js/, 'build bundles the Supabase client locally');
assert.match(appBuild, /\.cache\/web/, 'drawer app output is temporary cached web assets');
assert.match(webBuild, /supabase-config\.js/, 'public site build verifies the configuration asset');
assert.match(webBuild, /supabase-client\.js/, 'public site build verifies the client asset');
assert.match(webBuild, /\.cache\/web/, 'public site output is temporary cached web assets');
assert.match(workerConfig, /name = "lulu-board"/, 'Workers Builds deploys the existing Worker');
assert.match(workerConfig, /directory = "\.\/\.cache\/web\/"/, 'Worker deploys the generated cache directory');
assert.match(cloud, /https:\/\/api\.luluboard\.app\/graphs/, 'first insert calls the board API');
assert.match(cloud, /Authorization: "Bearer " \+ accessToken/, 'first insert sends the user JWT');
assert.doesNotMatch(cloud, /create_owned_graph_with_group/, 'web create no longer calls the old SQL function');
assert.match(cloud, /expected_version:\s*expected/, 'updates send the server version');
assert.match(cloud, /method:\s*"PATCH"/, 'updates call the board API');
assert.doesNotMatch(cloud, /\.from\("graphs"\)\.update/, 'web update no longer patches the table');
assert.match(cloud, /\.select\("graph_id,title,bmd,version,share_id,created_at,updated_at"\)/, 'owner load also reads share_id');
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
assert.match(cloud, /redirectTo: returnTo/, 'OAuth uses redirectTo');
assert.match(cloud, /var returnTo = location\.origin \+ "\/\?ws=1"/, 'OAuth always returns to /?ws=1 (LB-356)');
assert.doesNotMatch(cloud, /returnTo = location\.origin \+ location\.pathname/, 'OAuth no longer returns to the pre-login URL');
assert.match(cloud, /cloudRefreshGroups/, 'the drawer group list is loaded from Supabase');
assert.match(cloud, /function cloudAccountProfile/, 'account chrome reads the OAuth profile');
assert.match(cloud, /function cloudCloseAccountMenus/, 'account menus share one close path');
assert.match(cloud, /function cloudShowSignInDialog/, 'unsigned cloud hash opens the dialog');
assert.match(cloud, /cloudShowSignInDialog\(\)/, 'unsigned #b: load shows the dialog');
assert.match(cloud, /if \(signedIn\) cloudHideSignInDialog/, 'signed-in chrome closes the dialog');
assert.match(cloud, /function cloudDeclineCloudDiagram/, 'Not now leaves the cloud pointer');
assert.match(cloud, /btnShellSignInClose[\s\S]*cloudDeclineCloudDiagram/, 'Not now resets the URL off #b:');
assert.match(cloud, /async function cloudDeclineCloudDiagram[\s\S]*bootstrapDiagramFromHash/, 'declining seeds an unsigned #z: board');
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
    title: "Sync",
  });
  assert.deepStrictEqual(helpers.cloudSaveButtonCopy(true, false), {
    hidden: false,
    pending: true,
    current: false,
    label: "Saved",
    title: "Save",
  });
}

{
  // four save states: tip text (from aria-label) and aria-label, no native title
  const start = cloud.indexOf('function cloudVersionsAligned');
  const end = cloud.indexOf('function cloudSetAccountUi');
  const mkEl = () => {
    const attrs = {}, cls = new Set();
    return { hidden: true, disabled: false, attrs,
      setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
      removeAttribute(k) { delete attrs[k]; },
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) } };
  };
  const run = (env) => {
    const save = mkEl(), status = mkEl();
    new Function('env', 'save', 'status', `
      var cloudSession = env.signedIn ? { user: {} } : null, cloudPlusDraftActive = false, liveDiagramId = '';
      var diagramServerRev = env.server, diagramLocalRev = env.client;
      var document = { getElementById: (id) => id === 'btnShellSaveCloud' ? save : status };
      function isLocalDrawerPreview() { return !!env.local; }
      function cloudDiagramId() { return env.id || ''; }
      function emit() {}
      function call() {}
      ${cloud.slice(start, end)}
      syncCloudSaveChrome();`)(env, save, status);
    return { save, status };
  };
  const uncreated = run({ signedIn: true, id: '', server: 0, client: 1 });
  assert.strictEqual(uncreated.save.hidden, false);
  assert.strictEqual(uncreated.save.getAttribute('aria-label'), 'Create', '#z uncreated → Create');
  const dirty = run({ signedIn: true, id: 'b_1', server: 3, client: 4 });
  assert.strictEqual(dirty.save.hidden, false);
  assert.strictEqual(dirty.save.getAttribute('aria-label'), 'Save', 'unsaved → Save');
  const synced = run({ signedIn: true, id: 'b_1', server: 4, client: 4 });
  assert.strictEqual(synced.status.hidden, false);
  assert.strictEqual(synced.status.getAttribute('aria-label'), 'Sync', 'synced green → Sync');
  assert.strictEqual(synced.save.hidden, true);
  const out = run({ signedIn: false, local: true });
  assert.strictEqual(out.save.hidden, false);
  assert.strictEqual(out.save.getAttribute('aria-label'), 'Sign in to save', 'local signed out → Sign in to save');
  assert.ok(out.save.classList.contains('is-signed-out'), 'signed out is the faded state');
  const prod = run({ signedIn: false, local: false });
  assert.strictEqual(prod.save.hidden, true, 'signed out on production stays hidden');
  assert.strictEqual(prod.status.hidden, true);
  for (const r of [uncreated, dirty, synced, out]) {
    assert.ok(!('title' in r.save.attrs) && !('title' in r.status.attrs), 'no native title');
  }
  assert.match(cloud, /emit\("bindChromeTip", save, function \(\) \{ return save\.getAttribute\("aria-label"\) \|\| ""; \}\)/, 'tip text is the aria-label');
}
{
  // signed out click: toast only, no save, no sign-in, no navigation
  const a = cloud.indexOf('if (save) save.addEventListener("click", function () {');
  const b = cloud.indexOf('\n  });', a);
  const handler = cloud.slice(cloud.indexOf('function () {', a), b + 4);
  const calls = [];
  const env = {
    save: { classList: { contains: (c) => c === 'is-signed-out' } },
    showCopyTip: (m) => calls.push(['toast', m]),
    saveDiagramToCloud: () => calls.push(['save']),
    forkSharedDiagram: () => calls.push(['fork']),
    isShareGuest: () => false,
    cloudCloseAccountMenus: () => calls.push(['menus']),
    cloudShowSignInDialog: () => calls.push(['signin']),
    location: { assign: () => calls.push(['nav']), set href(v) { calls.push(['nav']); } },
    emit(name) { if (typeof env[name] === 'function') return env[name].apply(null, [].slice.call(arguments, 1)); },
    call(name) { if (typeof env[name] === 'function') return env[name].apply(null, [].slice.call(arguments, 1)); },
  };
  const click = new Function(...Object.keys(env), 'return ' + handler.replace(/\);?\s*$/, ''))(...Object.values(env));
  click();
  assert.deepStrictEqual(calls, [['toast', 'Sign in to save to the cloud']], 'signed out click only shows the toast');
  calls.length = 0;
  env.save.classList.contains = () => false;
  click();
  assert.deepStrictEqual(calls, [['menus'], ['save']], 'signed in click still saves');
}
const diagramCss = read('packages/drawer-app/css/03-diagram.css');
{
  const block = diagramCss.match(/\.shell-cloud-status\.is-pending\.is-signed-out \{[^}]+\}/);
  assert.ok(block, 'signed out has its own rule');
  assert.match(block[0], /opacity:\s*\.5/, 'signed out is faded');
  assert.match(block[0], /cursor:\s*default/, 'signed out uses the default cursor');
}

{
  const start = cloud.indexOf('function cloudRowSource');
  const end = cloud.indexOf('function applyCloudDiagramRow');
  assert.ok(start >= 0 && end > start, 'cloudRowSource is a closed function');
  const helpers = new Function('stripDocumentMeta', cloud.slice(start, end) + '\nreturn { cloudRowSource };')(function (t) { return String(t); });
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
  const end = cloud.indexOf('async function saveDiagramToCloud');
  assert.ok(start >= 0 && end > start, 'cloudSignOut is a closed function');
  const body = cloud.slice(start, end);
  assert.match(body, /history\.replaceState/, 'sign-out drops the #b: hash');
  assert.match(body, /bootstrapDiagramFromHash/, 'sign-out seeds a blank local board');
  assert.doesNotMatch(body, /cloudClearOpenDiagram/, 'sign-out does not empty the source in place');
}

{
  const start = cloud.indexOf('function groupDiagramRowsByGroup');
  const sib = cloud.indexOf('function loadSiblingDiagramIds');
  const save = cloud.indexOf('async function saveDiagramToCloud');
  assert.ok(start >= 0 && sib > start && save > sib, 'group helpers are closed functions');
  const helpers = new Function(
    cloud.slice(start, save) + '\nreturn { groupDiagramRowsByGroup, loadSiblingDiagramIds };'
  )();
  const a = { graph_id: 'b_11111111', title: 'A', updated_at: '2026-10-04T12:00:00Z' };
  const b = { graph_id: 'b_22222222', title: 'B', updated_at: '2026-10-04T11:00:00Z' };
  const c = { graph_id: 'b_33333333', title: 'C', updated_at: '2026-10-03T10:00:00Z' };
  const memberships = [
    { graph_id: 'b_11111111', group_id: 'g_aaaa0001' },
    { graph_id: 'b_22222222', group_id: 'g_aaaa0001' },
    { graph_id: 'b_33333333', group_id: 'g_bbbb0002' },
  ];
  const grouped = helpers.groupDiagramRowsByGroup([a, b, c], memberships);
  assert.strictEqual(grouped.length, 2);
  assert.strictEqual(grouped[0].group_id, 'g_aaaa0001');
  assert.deepStrictEqual(grouped[0].members.map((row) => row.graph_id), ['b_11111111', 'b_22222222']);
  assert.strictEqual(grouped[1].members[0].graph_id, 'b_33333333');
  const solo = helpers.groupDiagramRowsByGroup([c], [memberships[2]]);
  assert.strictEqual(solo.length, 1);
  assert.strictEqual(solo[0].members.length, 1);
  assert.deepStrictEqual(helpers.loadSiblingDiagramIds('b_11111111', memberships), ['b_22222222']);
  assert.deepStrictEqual(helpers.loadSiblingDiagramIds('b_33333333', [memberships[2]]), []);
}

{
  const groups = fs.readFileSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-groups.js'), 'utf8');
  assert.match(groups, /rpc\("list_mine_groups"/, 'groups load a page from the mine rpc');
  assert.doesNotMatch(groups, /group_members/, 'group_members is gone');
  assert.match(groups, /groupDiagramRowsByGroup/, 'groups are built by group');
  const refresh = cloud.slice(cloud.indexOf('async function cloudRefreshGroups'), cloud.indexOf('async function deleteCloudGroup'));
  assert.match(refresh, /cloudFetchGroupSummaries/, 'the refresh reads the shared group data');
  assert.match(refresh, /emit\("shellRenderMine", page\.groups\)/, 'the drawer renders the loaded page');
}

{
  const del = cloud.slice(
    cloud.indexOf('async function deleteCloudGroup'),
    cloud.indexOf('(function wireCloudAuth')
  );
  assert.match(del, /from\("graphs"\)\.delete\(\)\.in\("graph_id"/, 'group delete removes every board');
  assert.doesNotMatch(del, /from\("groups"\)/, 'group delete no longer touches the groups table');
}

{
  const load = cloud.slice(
    cloud.indexOf('async function loadCloudDiagramByHash'),
    cloud.indexOf('async function cloudRefreshGroups')
  );
  const reject = load.indexOf('if (!diagramId) return false');
  const members = load.search(/refreshCloudGroupMembers|from\("group_members"\)|loadSiblingDiagramIds/);
  assert.ok(reject >= 0 && members > reject, 'invalid hash returns false and does not query groups');
  assert.match(load, /refreshCloudGroupMembers/, '#b: first open still refreshes group tabs');
  assert.match(load, /cloudKnownGroupDiagram/, '#b: known sibling skips the group list');
  assert.match(load, /cloudCachedDiagramRow/, '#b: uses an in-memory row when present');
  assert.match(load, /if \(cached\)/, '#b: cache hit does not query boards');
  assert.doesNotMatch(load, /cloudRefreshGroups/, 'opening a board does not refresh the whole mine list');
  assert.match(load, /emit\("shellRenderMine"\)/, 'opening a board repaints the mine highlight from loaded pages');
  const switching = load.search(/var switching = diagramId !== liveDiagramId;/);
  assert.ok(switching >= 0 && switching < load.indexOf('await cloudSessionReady'), 'a switch is judged against the shown board before any await or apply');
  assert.doesNotMatch(load, /swap: true/, 'opening the shown board again does not fade');
  assert.equal((load.match(/swap: switching/g) || []).length, 2, 'both open paths fade only on a switch');
  assert.match(load, /emit\("renderDiagram", \{ fit: false, restoreView: true, swap: switching \}\)/, 'a switched board hides the drawing before paint');
  assert.match(boardJs, /function holdDiagramSwap/, 'switch can hide the drawing');
  assert.match(boardJs, /!preview \|\| !preview\.childElementCount/, 'first paint does not hide an empty drawing');
  assert.match(boardJs, /diagramSwapSeq \+= 1/, 'a later paint invalidates an in-flight hide');
  assert.match(boardJs, /if \(html && html\.dataset\.diagramSwap\) delete html\.dataset\.diagramSwap/, 'a paint without swap drops a leftover hide');
  assert.match(boardJs, /dataset\.diagramSwap = "hold"/, 'the hide is instant');
  assert.match(boardJs, /dataset\.diagramSwap = "in"/, 'the drawing fades back in');
  assert.match(boardJs, /function finishCanvasView[\s\S]*releaseDiagramSwap\(opts\)/, 'other kinds release the hide after the camera');
  assert.match(boardJs, /function previewHasPaint/, 'boot wait is not boxes-only');
  assert.match(boardJs, /\.board-render, iframe\.sketch-frame, svg/, 'sketch and svg count as painted');
  const css = read('packages/drawer-app/css/02-chrome.css');
  assert.match(css, /html\[data-diagram-swap="hold"\] #preview \{[^}]*opacity:\s*0/, 'only the drawing is hidden');
  assert.match(css, /html\[data-diagram-swap="in"\] #preview \{[^}]*transition:\s*opacity 150ms/, 'the drawing fades in');
  assert.doesNotMatch(css, /data-diagram-swap="hold"\][^{]*\.canvas-shell|data-diagram-swap="hold"\][^{]*#preview-stage/, 'the dotted canvas stays visible');
  assert.match(load, /cloudParkPlusDraft/, '#b: parks an active plus draft');
  assert.doesNotMatch(load, /cloudPlusDraft = false/, '#b: load keeps the parked plus draft');
  assert.match(load, /from\("graphs"\)[\s\S]*maybeSingle/, '#b: still opens one boards row');
  assert.doesNotMatch(load, /location\.hash\s*=/, '#b: open does not rewrite the hash');
  assert.doesNotMatch(load, /from\("groups"\)/, 'sibling load uses membership, not groups');
  assert.doesNotMatch(load, /open_share|rotate_share|set_share_role|save_shared_graph/);
}

{
  const auth = cloud.slice(
    cloud.indexOf('cloudClient.auth.onAuthStateChange'),
    cloud.indexOf('setCloudSessionReady(cloudClient.auth.getSession()')
  );
  assert.ok(auth.length > 0, 'the auth subscription is a closed block');
  assert.match(auth, /setCloudSession\(session \|\| null\)/, 'auth events still sync the session');
  assert.match(auth, /cloudSetAccountUi\(\)/, 'auth events still repaint the account chrome');
  assert.doesNotMatch(auth, /loadCloudDiagramByHash|loadSharedDiagramByHash/, 'tab refocus and token refresh do not reopen a board');
  assert.match(auth, /cloudSession && !cloudShareIdFromHash\(location\.hash\)\) void cloudRefreshGroups\(\)/, 'a share link still skips the list refresh');
}

{
  const start = cloud.indexOf('function cloudCachePut');
  const end = cloud.indexOf('function cloudRememberDiagramRow');
  assert.ok(start >= 0 && end > start, 'cloudCachePut is a closed helper');
  const helpers = new Function(cloud.slice(start, end) + '\nreturn { cloudCachePut, cloudCacheGet };')();
  const store = {};
  helpers.cloudCachePut(store, { graph_id: 'b_11111111', title: 'One', bmd: 'board "One"\n', version: 2, dirty: true, localRev: 3 });
  assert.strictEqual(helpers.cloudCacheGet(store, 'b_11111111').bmd, 'board "One"\n');
  assert.strictEqual(helpers.cloudCacheGet(store, 'b_11111111').dirty, true);
  assert.strictEqual(helpers.cloudCacheGet(store, 'b_22222222'), null);
}

{
  const save = cloud.slice(
    cloud.indexOf('async function saveDiagramToCloud'),
    cloud.indexOf('async function loadCloudDiagramByHash')
  );
  const minted = save.indexOf('if (!diagramId)');
  const updated = save.indexOf('} else {');
  assert.ok(minted >= 0 && updated > minted);
  const insertBranch = save.slice(minted, updated);
  const updateBranch = save.slice(updated);
  assert.match(insertBranch, /https:\/\/api\.luluboard\.app\/graphs/);
  assert.match(insertBranch, /diagram_id:\s*diagramId/);
  assert.match(insertBranch, /joinGroupId = cloudPlusDraftActive && cloudGroupId \? cloudGroupId : null/);
  assert.match(insertBranch, /if \(joinGroupId\) payload\.group_id = joinGroupId/);
  assert.doesNotMatch(insertBranch, /search_text/);
  assert.match(save, /cloudPlusDraftActive && !opts\.explicit/, 'plus draft does not autosave');
  assert.doesNotMatch(insertBranch, /from\("graphs"\)\.insert|from\("group_members"\)/);
  assert.match(insertBranch, /cloudSetDiagramHash\(diagramId/);
  assert.match(updateBranch, /https:\/\/api\.luluboard\.app\/graphs/);
  assert.match(updateBranch, /method:\s*"PATCH"/);
  assert.match(updateBranch, /diagram_id:\s*diagramId/);
  assert.match(updateBranch, /expected_version:\s*expected/);
  assert.doesNotMatch(updateBranch, /search_text/);
  assert.doesNotMatch(updateBranch, /\.update\(\{/);
  assert.match(updateBranch, /status === 409/);
  assert.doesNotMatch(updateBranch, /create_owned_graph_with_group|from\("group_members"\)/);
  assert.doesNotMatch(updateBranch, /share_id\s*:/);
  assert.doesNotMatch(save, /from\("graphs"\)\.(insert|update)\([\s\S]*group_id/);
}

{
  const tabs = read('packages/drawer-app/src/cloud/cloud-group-tabs.js');
  const tabCss = read('packages/drawer-app/css/06-group-tabs.css');
  const start = tabs.indexOf('function sortDiagramRowsByGroupOrder');
  const end = tabs.indexOf('function cloudGroupTabsVisible');
  assert.ok(start >= 0 && end > start, 'sortDiagramRowsByGroupOrder is a closed function');
  const helpers = new Function(tabs.slice(start, end) + '\nreturn { sortDiagramRowsByGroupOrder };')();
  const sorted = helpers.sortDiagramRowsByGroupOrder(
    [{ graph_id: 'b_22222222' }, { graph_id: 'b_11111111' }],
    [{ graph_id: 'b_22222222', sort_order: 2 }, { graph_id: 'b_11111111', sort_order: 1 }]
  );
  assert.deepStrictEqual(sorted.map((row) => row.graph_id), ['b_11111111', 'b_22222222']);
  assert.match(tabs, /cloudStartPlusDraft/, 'plus starts a local draft');
  assert.match(tabs, /askConfirm/, 'dirty saved tabs use the in-app confirm');
  assert.match(tabs, /isShareGuest/, 'share guests do not see group tabs');
  assert.match(tabCss, /\.group-tab-float/, 'group tabs are canvas chrome');
  assert.match(tabCss, /flex-direction: column/, 'group tabs stack vertically');
  assert.match(tabCss, /z-index: 4/, 'open dock covers the tab strip');
}

console.log('ok cloud-sync');
