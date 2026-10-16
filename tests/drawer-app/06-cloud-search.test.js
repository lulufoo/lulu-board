'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const search = read('packages/drawer-app/js/06-cloud-search.js');
const drawer = read('packages/drawer-app/js/09-shell-drawer.js');
const appBuild = read('scripts/drawer-app-build/build.mjs');

assert.match(appBuild, /06-cloud-search\.js/, 'search helper is in the drawer bundle');
assert.match(search, /rpc\("search_boards"/, 'search uses the login rpc');
assert.match(drawer, /cloudSearchBoards/, 'the search pop calls the helper');

const { cloudSearchSplit } = new Function(
  search.slice(search.indexOf('function cloudSearchSplit'), search.indexOf('async function cloudSearchBoards')) +
  '\nreturn { cloudSearchSplit };'
)();

assert.deepStrictEqual(cloudSearchSplit([]), { mine: [], public: [] });
{
  const out = cloudSearchSplit([
    { category: 'mine', title: 'Mine one', share_id: 's_a', board_id: 'b_1' },
    { category: 'public', title: 'Other public', share_id: 's_b', board_id: null },
    { category: 'mine', title: 'Mine public', share_id: 's_c', board_id: 'b_2' },
  ]);
  assert.deepStrictEqual(out.mine.map((r) => r.boardId), ['b_1', 'b_2']);
  assert.deepStrictEqual(out.public.map((r) => r.shareId), ['s_b']);
  assert.strictEqual(out.public[0].boardId, '', 'public hits do not carry board_id');
  assert.strictEqual(out.public[0].note, 'Public');
}
console.log('ok 06-cloud-search');
