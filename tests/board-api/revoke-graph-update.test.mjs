import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sqlName = readdirSync(path.join(root, 'supabase/migrations')).find((name) => name.endsWith('_lb545_revoke_graph_text_update.sql'));
const sql = readFileSync(path.join(root, 'supabase/migrations', sqlName), 'utf8');

assert.match(sql, /revoke update \(title, bmd\) on table public\.graphs from authenticated/);
assert.doesNotMatch(sql, /revoke\s+(all|select|delete)/i);

console.log('ok revoke graph text update');
