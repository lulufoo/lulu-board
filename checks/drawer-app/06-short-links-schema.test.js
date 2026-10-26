import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const sqlPath = path.join(root, 'supabase/migrations/20261024133000_lb415_short_links.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

assert.match(sql, /create table if not exists public\.short_links/, 'creates short_links');
assert.match(sql, /id text primary key/, 'id is the primary key');
assert.match(sql, /bmd text not null/, 'stores source as bmd');
assert.match(sql, /created_at timestamptz not null default now\(\)/, 'records created_at');
assert.match(sql, /expires_at timestamptz not null/, 'has expires_at');
assert.match(
  sql,
  /expires_at = created_at \+ interval '30 minutes'/,
  'expires_at must equal created_at plus 30 minutes'
);
assert.match(sql, /short_links_set_expiry/, 'insert writes expires_at');
assert.match(sql, /id ~ '\^p_\[0-9a-f\]\{64\}\$'/, 'id is p_ plus 64 lowercase hex');
assert.match(sql, /enable row level security/, 'RLS is on');
assert.match(
  sql,
  /revoke all on table public\.short_links from anon, authenticated, public/,
  'clients cannot read or write the table'
);
assert.doesNotMatch(sql, /token_hash/, 'no edit token');
assert.doesNotMatch(sql, /owner_id|share_id|graph_id|group_id/, 'not mixed with graphs');
assert.doesNotMatch(sql, /create policy/i, 'no listing or client policies');
assert.doesNotMatch(sql, /grant (select|insert|update|delete)/i, 'no client grants');

console.log('ok short-links-schema');
