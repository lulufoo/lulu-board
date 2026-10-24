'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261024145835_lb420_group_shells.sql'),
  'utf8'
);

assert.match(
  sql,
  /create function public\.load_group_shells\(p_graph_id text, p_group_id text default null\)/,
  'shell rpc takes a board id and an optional group id'
);
assert.match(sql, /security definer/i, 'rpc bypasses table rls');
assert.match(sql, /auth\.uid\(\)/, 'rpc requires the signed-in user');
assert.match(
  sql,
  /returns table\(graph_id text, group_id text, title text, sort_order integer\)/,
  'shell columns are id, group, title, and order'
);
assert.doesNotMatch(sql, /\bbmd\b/, 'shell rpc does not read or return diagram bodies');
assert.match(
  sql,
  /where r\.owner_id = v_uid and r\.graph_id = p_graph_id/,
  'the group is read from the board row'
);
assert.match(
  sql,
  /where r\.owner_id = v_uid and r\.group_id = v_group/,
  'shells are the rows of that group'
);
assert.doesNotMatch(sql, /r\.group_id = p_group_id/, 'a passed group id does not replace the board row');
assert.match(sql, /order by r\.sort_order, r\.graph_id/, 'shells follow the stored order');
assert.match(
  sql,
  /grant execute on function public\.load_group_shells\(text, text\) to anon, authenticated/,
  'signed-in and signed-out roles may call it; the function rejects a missing user'
);

console.log('ok group-shells-rpc');
