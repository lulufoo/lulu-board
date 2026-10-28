import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sqlName = readdirSync(path.join(root, 'supabase/migrations')).find((name) => name.endsWith('_lb539_save_shared_graph_search_text.sql'));
const sql = readFileSync(path.join(root, 'supabase/migrations', sqlName), 'utf8');

assert.match(sql, /create function public\.save_shared_graph\(\s*p_share_id text,\s*p_title text,\s*p_bmd text,\s*p_search_text text,\s*p_expected integer/s);
assert.match(sql, /search_text = nullif\(btrim\(p_search_text\), ''\)/);
assert.match(sql, /btrim\(p_bmd\) = ''/);
assert.match(sql, /g\.role = 'edit'/);
assert.match(sql, /r\.version = p_expected/);
assert.match(sql, /create or replace function public\.save_shared_graph\(\s*p_share_id text,\s*p_title text,\s*p_bmd text,\s*p_expected integer/s);
assert.match(sql, /save_shared_graph\(p_share_id, p_title, p_bmd, null::text, p_expected\)/);
assert.match(sql, /security definer/i);
assert.doesNotMatch(sql, /service_role key|SUPABASE_SERVICE/i);

console.log('ok save_shared_graph search_text');
