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
const workerConfig = read('wrangler.toml');

assert.match(html, /Content-Security-Policy/, 'public page declares a CSP');
assert.match(html, /id="btnBoardSignIn"/, 'public page exposes sign in');
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
assert.match(cloud, /onConflict: "owner_id,board_id"/, 'cloud saves upsert one row per owner and board');
assert.match(cloud, /provider: selected/, 'cloud sign in selects an OAuth provider');
assert.match(cloud, /flowType: "pkce"/, 'OAuth callbacks use query-based PKCE, not a token fragment');
assert.match(cloud, /refreshCloudBoardHistory/, 'cloud History is loaded from Supabase');
assert.match(schema, /primary key \(owner_id, board_id\)/, 'each owner can hold one latest copy per board id');
assert.match(schema, /bmd text not null/, 'the current BMD source is stored in Postgres');
assert.match(schema, /enable row level security/, 'the cloud board table has RLS enabled');
assert.match(schema, /with check \(\(select auth\.uid\(\)\) = owner_id\)/, 'inserts are owner-scoped');

console.log('ok cloud-sync');
