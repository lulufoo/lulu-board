'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const shares = read('packages/drawer-app/js/06-cloud-shares.js');
const drawer = read('packages/drawer-app/js/09-shell-drawer.js');
const dialog = read('packages/drawer-app/js/09-share-dialog.js');
const sync = read('packages/drawer-app/js/06-cloud-sync.js');
const appBuild = read('scripts/drawer-app-build/build.mjs');

assert.match(appBuild, /06-cloud-share\.js[\s\S]*06-cloud-shares\.js/, 'shares module is built after the share rpc helpers');
assert.match(shares, /\.not\("share_id", "is", null\)/, 'the list is the boards that have a share link');
assert.match(shares, /own_share_state/, 'each link role comes from own_share_state (grants has no client read policy)');
for (const rpc of ['open_share', 'rotate_share', 'unshare', 'set_share_role']) {
  assert.match(shares + drawer + dialog, new RegExp(rpc), rpc + ' is reachable from the drawer or the Share dialog');
}
assert.match(drawer, /Stop sharing this diagram\?/, 'Stop asks first: the link stops working');
assert.match(sync, /cloudRefreshShares\(\)/, 'the group refresh also refreshes the shared list');

const { cloudShareSummaries } = new Function(
  shares.slice(shares.indexOf('function cloudShareSummaries'), shares.indexOf('function cloudShareLinkFor')) +
  '\nreturn { cloudShareSummaries };'
)();

const row = (id, share, updated) => ({ graph_id: id, title: 'T ' + id, share_id: share, updated_at: updated });
assert.deepStrictEqual(cloudShareSummaries([], {}, 'b_1'), []);
{
  const out = cloudShareSummaries(
    [row('b_1', 's_a', '2026-10-01T00:00:00Z'), row('b_2', 's_b', '2026-10-03T00:00:00Z'), row('b_3', null, '2026-10-05T00:00:00Z')],
    { s_a: 'edit' },
    'b_1'
  );
  assert.deepStrictEqual(out.map((s) => s.diagramId), ['b_2', 'b_1'], 'newest first; boards without a link are not listed');
  assert.strictEqual(out[1].role, 'edit', 'role from the grant');
  assert.strictEqual(out[0].role, 'view', 'unknown role falls back to view');
  assert.strictEqual(out[1].isCurrent, true, 'the open board is marked');
  assert.strictEqual(out[0].isCurrent, false);
  assert.strictEqual(out[0].isPublic, false, 'unknown public flag is off');
  assert.strictEqual(out[1].isPublic, false);
}
{
  const out = cloudShareSummaries([row('b_1', 's_a', '2026-10-01T00:00:00Z')], { s_a: 'view' }, '', { s_a: true });
  assert.strictEqual(out[0].isPublic, true, 'public flag comes from own_share_state');
}
assert.strictEqual(cloudShareSummaries([row('b_1', 's_a', '')], {}, '')[0].isCurrent, false, 'no open board: nothing marked');
console.log('ok 06-cloud-shares');
