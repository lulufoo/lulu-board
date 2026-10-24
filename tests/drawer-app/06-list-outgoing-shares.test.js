'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261024153305_lb425_list_outgoing_shares.sql'),
  'utf8'
);

assert.match(sql, /create function public\.list_outgoing_shares\(\)/, 'outgoing shares are one list rpc');
assert.match(sql, /security definer/i, 'rpc bypasses table rls');
assert.match(sql, /auth\.uid\(\)/, 'rpc requires the signed-in user');
assert.match(sql, /r\.owner_id = v_uid and r\.share_id is not null/, 'only the caller shared diagrams');
assert.match(sql, /a\.principal = 'all'/, 'the link role is the all grant');
assert.match(sql, /g\.principal = 'public'/, 'public is a separate grant');
assert.match(sql, /coalesce\(a\.role, 'view'::text\)/, 'a link without an all grant stays view');
assert.match(sql, /select count\(\*\)::integer from shared/, 'the total is every shared diagram');
assert.match(sql, /order by s\.updated_at desc, s\.graph_id desc/, 'newest shared diagram first');
assert.doesNotMatch(sql, /\bbmd\b/, 'the list does not read or return diagram bodies');

console.log('ok list-outgoing-shares');
