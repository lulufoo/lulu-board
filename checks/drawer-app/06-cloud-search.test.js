import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const search = read('packages/drawer-app/src/cloud/cloud-search.js');
const drawer = read('packages/drawer-app/src/chrome/shell-drawer.js');
const appBuild = read('scripts/build-app/drawer.mjs');

assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-search.js')), 'search helper is in the drawer bundle');
assert.match(search, /https:\/\/api\.luluboard\.app\/search/, 'search uses the board API');
assert.match(drawer, /cloudSearchDiagrams/, 'the search pop calls the helper');

const { cloudSearchSplit } = new Function(
  search.slice(search.indexOf('function cloudSearchSplit'), search.indexOf('async function cloudSearchDiagrams')) +
  '\nreturn { cloudSearchSplit };'
)();

assert.deepStrictEqual(cloudSearchSplit([]), { mine: [], public: [] });
{
  const out = cloudSearchSplit([
    { category: 'mine', title: 'Mine one', share_id: 's_a', graph_id: 'b_1' },
    { category: 'public', title: 'Other public', share_id: 's_b', graph_id: null },
    { category: 'mine', title: 'Mine public', share_id: 's_c', graph_id: 'b_2' },
  ]);
  assert.deepStrictEqual(out.mine.map((r) => r.diagramId), ['b_1', 'b_2']);
  assert.deepStrictEqual(out.public.map((r) => r.shareId), ['s_b']);
  assert.strictEqual(out.public[0].diagramId, '', 'public hits do not carry graph_id');
  assert.strictEqual(out.public[0].note, 'Public');
}
console.log('ok 06-cloud-search');
