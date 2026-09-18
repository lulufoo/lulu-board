'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const appBuild = read('scripts/drawer-app-build/build.mjs');
const webBuild = read('scripts/web-build/build.mjs');
const cloud = read('packages/drawer-app/js/06-cloud-sync.js');
const schema = read('supabase/migrations/20260917160000_create_boards.sql');
const versionSql = read('supabase/migrations/20260918090000_boards_version.sql');
const workerConfig = read('wrangler.toml');

assert.match(html, /Content-Security-Policy/, 'public page declares a CSP');
assert.match(html, /img-src[^"]*https:\/\/\*\.googleusercontent\.com/, 'CSP allows Google avatars');
assert.match(html, /img-src[^"]*https:\/\/avatars\.githubusercontent\.com/, 'CSP allows GitHub avatars');
assert.match(html, /id="btnBoardSignIn"/, 'public page exposes sign in');
assert.match(html, /id="btnBoardAccount"/, 'signed-in account is a menu button');
assert.match(html, /id="boardSessionMenu"/, 'account menu holds session actions');
assert.match(html, /id="btnBoardSaveCloud"/, 'Save to cloud stays in the toolbar');
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
assert.match(cloud, /\.insert\([\s\S]*\.select\("board_id,title,bmd,version,updated_at"\)/, 'insert returns the saved source');
assert.match(cloud, /\.update\([\s\S]*\.select\("board_id,title,bmd,version,updated_at"\)/, 'update returns the saved source');
assert.doesNotMatch(cloud, /onConflict/, 'cloud saves do not upsert');
assert.match(versionSql, /add column if not exists version/, 'version column is added');
assert.match(versionSql, /new\.version = coalesce\(old\.version, 1\) \+ 1/, 'update increments version');
assert.match(cloud, /provider: selected/, 'cloud sign in selects an OAuth provider');
assert.match(cloud, /flowType: "pkce"/, 'OAuth callbacks use query-based PKCE, not a token fragment');
assert.match(cloud, /refreshCloudBoardHistory/, 'cloud History is loaded from Supabase');
assert.match(cloud, /function cloudAccountProfile/, 'account chrome reads the OAuth profile');
assert.match(cloud, /function cloudCloseAccountMenus/, 'account menus share one close path');

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
