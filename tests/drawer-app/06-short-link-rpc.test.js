'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const sqlPath = path.join(root, 'supabase/migrations/20261024134000_lb416_short_link_rpc.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

assert.match(sql, /create function public\.create_short_link\(p_bmd text\)/, 'create rpc exists');
assert.match(sql, /create function public\.get_short_link\(p_id text\)/, 'read rpc exists');
assert.match(sql, /security definer/i, 'rpcs bypass table rls');
assert.match(sql, /'p_' \|\| encode\(extensions\.gen_random_bytes\(32\), 'hex'\)/, 'server mints p_ plus 64 hex');
assert.match(sql, /https:\/\/luluboard\.app\/#p:/, 'create returns the public short url');
assert.match(sql, /expires_at > now\(\)/, 'read rejects expired rows');
assert.match(
  sql,
  /grant execute on function public\.create_short_link\(text\) to anon, authenticated/,
  'create is public'
);
assert.match(
  sql,
  /grant execute on function public\.get_short_link\(text\) to anon, authenticated/,
  'read is public'
);
assert.doesNotMatch(sql, /auth\.uid/, 'rpcs do not require login');
assert.doesNotMatch(sql, /edit_token|token_hash/, 'no edit token');
assert.doesNotMatch(sql, /create function public\.\w*update/i, 'no write rpc');
assert.doesNotMatch(sql, /kv|redis/i, 'not kv');

console.log('ok short-link-rpc');
