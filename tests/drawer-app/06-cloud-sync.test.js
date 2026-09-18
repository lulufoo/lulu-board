'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readSql = (name) => fs.readFileSync(
  path.join(root, '../lulu-dev-skills/docs/archive/lulu-board/supabase/migrations', name),
  'utf8'
);

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
assert.match(html, /id="btnBoardAccount"/, 'signed-in account is a menu button');
assert.match(html, /id="boardSessionMenu"/, 'account menu holds session actions');
assert.match(html, /id="btnBoardSaveCloud"/, 'unsaved chrome stays in the toolbar');
assert.match(html, /id="btnDockProps"[\s\S]*id="btnDockSource"[\s\S]*id="btnDockStyle"[\s\S]*id="btnDockShare"[\s\S]*id="btnDockExport"[\s\S]*id="btnBoardOnboarding"/, 'Share is dock tab 4');
assert.match(dockCss, /\.board-dock\[data-open="share"\] \{\s*width:/, 'Share tab expands the dock');
assert.match(html, /id="btnShareRoleView"/, 'owner can choose view access');
assert.match(html, /id="btnShareRoleEdit"/, 'owner can choose edit access');
assert.doesNotMatch(html, /id="btnShareAddPerson"/, 'adding a person is not in the panel');
assert.match(html, /aria-label="Share audience"[\s\S]*Audience[\s\S]*Anyone with the link can open this board/, 'audience explains the public link');
assert.match(html, /class="share-actions"/, 'link actions are a stacked list');
assert.doesNotMatch(html, /shareLinkState|Not shared/, 'share panel has no Not shared status');
assert.doesNotMatch(shareJs, /Not shared|Link is on/, 'share chrome has no link-state copy');
assert.match(shareCss, /\.share-role-seg/, 'access uses a segmented control');
assert.doesNotMatch(html, /id="btnBoardShare"/, 'share left the toolbar');
assert.match(html, /id="btnBoardSaveCopy"/, 'shared viewers can save a copy');
assert.match(appBuild, /06-cloud-share\.js/, 'drawer app concatenates the share module');
assert.match(shareJs, /rpc\("get_shared_board"/, 'shared read uses get_shared_board');
assert.match(shareJs, /p_board_id: boardId/, 'share mutations pass the cloud board id');
assert.match(shareJs, /set_share_role/, 'owner access uses set_share_role');
assert.match(shareJs, /save_shared_board/, 'shared editors save through save_shared_board');
assert.match(shareJs, /function loadSharedBoardByHash/, 'hash bootstrap can load a share token');
{
  const start = shareJs.indexOf('function shareGuestHint');
  const end = shareJs.indexOf('function setShareEdit');
  assert.ok(start >= 0 && end > start, 'shareGuestHint is a closed function');
  const hint = new Function(shareJs.slice(start, end) + '\nreturn shareGuestHint;')();
  assert.strictEqual(hint(false, false), 'Sign in and save this board to share.');
  assert.strictEqual(hint(true, true), 'Only the owner can share this board.');
  assert.strictEqual(hint(true, false), 'Save this board to share.');
}
assert.match(shareJs, /showBoardError\(message\)/, 'a missing share token surfaces an error');
assert.doesNotMatch(shareJs, /from\("boards"\)/, 'share module does not select boards as anon');
assert.match(shareCss, /data-share-view/, 'share view hides owner edit chrome');
assert.match(boardJs, /dataset\.shareView === "on"\) return/, 'share view blocks board edits');
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
assert.match(cloud, /\.insert\(/, 'new boards insert a row');
assert.match(cloud, /\.eq\("version", expected\)/, 'updates CAS on the server version');
assert.match(cloud, /\.insert\([\s\S]*\.select\("board_id,title,bmd,version,share_id,updated_at"\)/, 'insert returns the saved source');
assert.match(cloud, /\.update\([\s\S]*\.select\("board_id,title,bmd,version,share_id,updated_at"\)/, 'update returns the saved source');
assert.match(cloud, /\.select\("board_id,title,bmd,version,share_id,created_at,updated_at"\)/, 'owner load also reads share_id');
assert.doesNotMatch(cloud, /onConflict/, 'cloud saves do not upsert');
assert.match(versionSql, /add column if not exists version/, 'version column is added');
assert.match(versionSql, /new\.version = coalesce\(old\.version, 1\) \+ 1/, 'update increments version');
assert.match(shareSql, /add column if not exists share_id/, 'share token is a boards column');
assert.match(shareSql, /create unique index if not exists boards_share_id_key/, 'share_id is globally unique');
assert.match(shareSql, /create table if not exists public\.grants/, 'grants hang off share_id');
assert.match(shareSql, /security definer/, 'share API is security-definer');
assert.match(shareSql, /function public\.open_share/, 'open_share mints the token');
assert.match(shareSql, /function public\.rotate_share/, 'rotate_share replaces the token');
assert.match(shareSql, /function public\.unshare/, 'unshare clears grants then share_id');
assert.match(shareSql, /function public\.get_shared_board/, 'get_shared_board is the only shared read');
assert.match(shareSql, /grant update \(title, bmd\) on table public\.boards to authenticated/, 'authenticated update is column-limited');
assert.match(shareSql, /grant insert \(owner_id, board_id, title, bmd\) on table public\.boards to authenticated/, 'clients cannot insert a share token');
assert.match(shareSql, /grant execute on function public\.get_shared_board\(text\) to anon, authenticated/, 'shared read is an rpc');
assert.doesNotMatch(shareSql, /grant select[^\n]*anon/, 'anon has no table select on boards');
assert.match(shareRoleSql, /function public\.set_share_role/, 'owner can change the all grant role');
assert.match(shareRoleSql, /function public\.own_share_state/, 'owner panel reads the current grant');
assert.match(shareRoleSql, /function public\.save_shared_board/, 'shared edit writes through rpc');
assert.match(shareRoleSql, /access text/, 'shared read returns the access role');
assert.match(shareRoleSql, /grant execute on function public\.save_shared_board/, 'shared edit is authenticated only');
assert.match(cloud, /provider: selected/, 'cloud sign in selects an OAuth provider');
assert.match(cloud, /flowType: "pkce"/, 'OAuth callbacks use query-based PKCE, not a token fragment');
assert.match(cloud, /refreshCloudBoardHistory/, 'cloud History is loaded from Supabase');
assert.match(cloud, /function cloudAccountProfile/, 'account chrome reads the OAuth profile');
assert.match(cloud, /function cloudCloseAccountMenus/, 'account menus share one close path');

{
  const start = cloud.indexOf('function cloudVersionsAligned');
  const end = cloud.indexOf('function syncCloudSaveChrome');
  assert.ok(start >= 0 && end > start, 'cloud save copy helpers are closed functions');
  const helpers = new Function(cloud.slice(start, end) + '\nreturn { cloudVersionsAligned, cloudSaveButtonCopy };')();
  assert.strictEqual(helpers.cloudVersionsAligned(5, 5), true);
  assert.strictEqual(helpers.cloudVersionsAligned(5, 6), false);
  assert.strictEqual(helpers.cloudVersionsAligned(0, 1), false);
  assert.strictEqual(helpers.cloudSaveButtonCopy(false, false).hidden, true);
  assert.deepStrictEqual(helpers.cloudSaveButtonCopy(true, true), {
    hidden: false,
    pending: false,
    current: true,
    label: "Saved",
    title: "Already saved to the cloud",
  });
  assert.deepStrictEqual(helpers.cloudSaveButtonCopy(true, false), {
    hidden: false,
    pending: true,
    current: false,
    label: "Saved",
    title: "Save this board to the cloud",
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
assert.match(schema, /primary key \(owner_id, board_id\)/, 'each owner can hold one latest copy per board id');
assert.match(schema, /bmd text not null/, 'the current BMD source is stored in Postgres');
assert.match(schema, /enable row level security/, 'the cloud board table has RLS enabled');
assert.match(schema, /with check \(\(select auth\.uid\(\)\) = owner_id\)/, 'inserts are owner-scoped');

{
  const start = cloud.indexOf('async function cloudSignOut');
  const end = cloud.indexOf('async function saveBoardToCloud');
  assert.ok(start >= 0 && end > start, 'cloudSignOut is a closed function');
  const body = cloud.slice(start, end);
  assert.match(body, /history\.replaceState/, 'sign-out drops the #b: hash');
  assert.match(body, /bootstrapBoardFromHash/, 'sign-out seeds a blank local board');
  assert.doesNotMatch(body, /cloudClearOpenBoard/, 'sign-out does not empty the source in place');
}

console.log('ok cloud-sync');
