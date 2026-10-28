import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sqlName = readdirSync(path.join(root, 'supabase/migrations')).find((name) => name.endsWith('_lb544_drop_save_shared_graph_wrapper.sql'));
const sql = readFileSync(path.join(root, 'supabase/migrations', sqlName), 'utf8');

assert.match(sql, /drop function public\.save_shared_graph\(text, text, text, integer\)/);
assert.doesNotMatch(sql, /drop function public\.save_shared_graph\(text, text, text, text, integer\)/);

console.log('ok drop save_shared_graph wrapper');
