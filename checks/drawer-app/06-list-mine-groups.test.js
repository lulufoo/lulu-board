import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261024153247_lb424_list_mine_groups.sql'),
  'utf8'
);

assert.match(sql, /create function public\.list_mine_groups\(p_before timestamptz default null, p_before_group_id text default null\)/, 'pages take a cursor');
assert.match(sql, /security definer/i, 'rpc bypasses table rls');
assert.match(sql, /auth\.uid\(\)/, 'rpc requires the signed-in user');
assert.match(sql, /limit 20/, 'one page is 20 groups');
assert.match(sql, /order by o\.updated_at desc, o\.group_id desc/, 'groups are newest first');
assert.match(sql, /o\.updated_at = p_before and o\.group_id < p_before_group_id/, 'the next page continues after the cursor');
assert.match(sql, /order by r\.group_id, r\.updated_at desc, r\.graph_id desc/, 'the row title is the newest diagram in the group');
assert.match(sql, /r\.sort_order/, 'shells keep the stored order');
assert.doesNotMatch(sql, /\bbmd\b/, 'the page does not read or return diagram bodies');
assert.match(sql, /select count\(\*\)::integer from owned/, 'the total is every group, not the page');
assert.doesNotMatch(sql, /p_graph_id/, 'the open diagram is not inserted into the page');

console.log('ok list-mine-groups');
