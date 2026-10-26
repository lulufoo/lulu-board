import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261024153220_lb423_group_updated_at.sql'),
  'utf8'
);

assert.match(sql, /alter table public\.groups\s+add column updated_at timestamptz/, 'groups gain an update time');
assert.match(sql, /select max\(r\.updated_at\)/, 'existing groups start from the newest diagram time');
assert.match(sql, /alter column updated_at set not null/, 'the update time is required');
assert.match(sql, /groups_owner_updated_idx/, 'pages can walk one account groups by update time');
assert.match(sql, /create function public\.touch_group_updated_at\(\)/, 'writes touch the group time');
assert.match(sql, /security definer/i, 'the trigger can update groups under row security');
assert.match(sql, /after insert or update or delete on public\.graphs/, 'insert, update, and delete all touch the group');
assert.match(sql, /set updated_at = new\.updated_at/, 'a write uses the diagram write time');
assert.match(sql, /tg_op = 'DELETE'/, 'delete also moves the group time');

console.log('ok group-updated-at');
