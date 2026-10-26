import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const sync = read('packages/drawer-app/src/cloud/cloud-sync.js');
const groups = read('packages/drawer-app/src/cloud/cloud-groups.js');
const appBuild = read('scripts/build-app/drawer.mjs');

assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-sync.js')), 'groups module is built after cloud sync');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-groups.js')), 'groups module is built after cloud sync');
assert.doesNotMatch(groups, /document\./, 'group data stays out of the DOM');
assert.match(sync, /await call\("cloudFetchGroupSummaries"\)/, 'the old history list reads the shared data function');

const grab = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const { cloudGroupSummaries } = new Function(
  grab(sync, 'function groupDiagramRowsByGroup', 'function loadSiblingDiagramIds') +
  grab(groups, 'function displayTitleFromBmd', 'function cloudMineCursor') +
  '\nreturn { cloudGroupSummaries };'
)();

const Meta = require('../../packages/drawer-app/src/core/document-meta.js').default;
global.diagramTitleFromBody = Meta.diagramTitleFromBody;
global.stripDocumentMeta = Meta.stripDocumentMeta;

const b = (id, title, updated) => ({
  graph_id: id,
  title: 'STALE',
  bmd: 'boxes "' + title + '"\n',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: updated,
});

assert.deepStrictEqual(cloudGroupSummaries([], [], 'b_1'), [], 'no boards, no groups');

{
  const rows = [b('b_3', 'Payments', '2026-10-03T00:00:00Z'), b('b_2', 'Retry', '2026-10-02T00:00:00Z'), b('b_1', 'LLM', '2026-10-01T00:00:00Z'), b('b_9', 'Orphan', '2026-10-04T00:00:00Z')];
  const members = [
    { graph_id: 'b_1', group_id: 'g_a' },
    { graph_id: 'b_2', group_id: 'g_b' },
    { graph_id: 'b_3', group_id: 'g_b' },
  ];
  const out = cloudGroupSummaries(rows, members, 'b_2');
  assert.deepStrictEqual(out.map((g) => g.groupId), ['g_b', 'g_a'], 'newest-edited group first; a board without a group is not listed');
  assert.strictEqual(out[0].title, 'Payments', 'title is parsed from the face board bmd, not graphs.title');
  assert.strictEqual(out[0].diagramCount, 2, 'counts the boards in the group');
  assert.deepStrictEqual(out[0].diagramIds, ['b_3', 'b_2']);
  assert.strictEqual(out[0].updatedAt, '2026-10-03T00:00:00Z');
  assert.strictEqual(out[0].isCurrent, true, 'current board inside the group marks it');
  assert.strictEqual(out[1].isCurrent, false);
  assert.strictEqual(out[0].faceDiagramId, 'b_3', 'opening the group goes to its face board');
}
{
  const rows = [b('b_1', 'LLM', '2026-10-01T00:00:00Z')];
  const out = cloudGroupSummaries(rows, [{ graph_id: 'b_1', group_id: 'g_a' }], '');
  assert.strictEqual(out[0].isCurrent, false, 'no current board: nothing marked');
  assert.strictEqual(cloudGroupSummaries(rows, [{ graph_id: 'b_1', group_id: 'g_a' }], 'b_404')[0].isCurrent, false, 'current board outside every group: nothing marked');
}
{
  const rows = [{
    graph_id: 'b_1',
    title: 'Untitled',
    bmd: 'style eyJ2aWV3cG9ydCI6eyJzY2FsZSI6MX0=\nsketch "拖动找不到页签"\n',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  }];
  const out = cloudGroupSummaries(rows, [{ graph_id: 'b_1', group_id: 'g_a' }], '');
  assert.strictEqual(out[0].title, '拖动找不到页签', 'a stored Untitled does not hide the sketch title');
}
assert.match(groups, /rpc\("list_mine_groups"/, 'mine pages come from the group page rpc');
assert.doesNotMatch(groups, /select\("graph_id,bmd/, 'mine no longer reads every diagram body');
assert.match(groups, /face_title/, 'the row title is the newest diagram title from the page');

const { cloudMinePageFromRows } = new Function(
  grab(groups, 'function cloudMinePageFromRows', 'async function cloudFetchGroupSummaries') +
  '\nreturn { cloudMinePageFromRows };'
)();
{
  const page = cloudMinePageFromRows([
    { total: 3, group_id: 'g_b', group_updated_at: '2026-10-03T00:00:00Z', face_graph_id: 'b_3', face_title: 'Payments', graph_id: 'b_2', title: 'Retry', sort_order: 1 },
    { total: 3, group_id: 'g_b', group_updated_at: '2026-10-03T00:00:00Z', face_graph_id: 'b_3', face_title: 'Payments', graph_id: 'b_3', title: 'Payments', sort_order: 2 },
  ], 'b_3');
  assert.strictEqual(page.total, 3, 'total is the whole list');
  assert.strictEqual(page.groups.length, 1, 'shell rows fold into one group');
  assert.strictEqual(page.groups[0].title, 'Payments');
  assert.strictEqual(page.groups[0].faceDiagramId, 'b_3');
  assert.deepStrictEqual(page.groups[0].diagramIds, ['b_2', 'b_3']);
  assert.strictEqual(page.groups[0].isCurrent, true);
}
console.log('ok 06-cloud-groups');
