import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sqlName = readdirSync(path.join(root, 'supabase/migrations')).find((name) => name.endsWith('_lb538_update_owned_graph.sql'));
const sql = readFileSync(path.join(root, 'supabase/migrations', sqlName), 'utf8');

assert.match(sql, /create function public\.update_owned_graph\(\s*p_graph_id text,\s*p_title text,\s*p_bmd text,\s*p_search_text text,\s*p_expected integer/s);
assert.match(sql, /security definer/i);
assert.match(sql, /auth\.uid\(\)/);
assert.match(sql, /search_text = nullif\(btrim\(p_search_text\), ''\)/);
assert.match(sql, /btrim\(p_bmd\) = ''/);
assert.match(sql, /r\.version = p_expected/);
const assignment = sql.slice(sql.indexOf('title ='), sql.indexOf('where r.owner_id'));
assert.doesNotMatch(assignment, /version\s*=/);
assert.doesNotMatch(sql, /service_role key|SUPABASE_SERVICE/i);
assert.match(sql, /grant execute on function public\.update_owned_graph\(text, text, text, text, integer\) to anon, authenticated, service_role/);

console.log('ok update_owned_graph');
