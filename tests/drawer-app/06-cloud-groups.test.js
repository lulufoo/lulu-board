'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const sync = read('packages/drawer-app/js/06-cloud-sync.js');
const groups = read('packages/drawer-app/js/06-cloud-groups.js');
const appBuild = read('scripts/drawer-app-build/build.mjs');

assert.match(appBuild, /06-cloud-sync\.js[\s\S]*06-cloud-groups\.js/, 'groups module is built after cloud sync');
assert.doesNotMatch(groups, /document\./, 'group data stays out of the DOM');
assert.match(sync, /await cloudFetchGroupSummaries\(\)/, 'the old history list reads the shared data function');

const grab = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const { cloudGroupSummaries } = new Function(
  grab(sync, 'function groupDiagramRowsByGroup', 'function loadSiblingDiagramIds') +
  grab(groups, 'function cloudGroupSummaries', '// Throws on a cloud error') +
  '\nreturn { cloudGroupSummaries };'
)();

const b = (id, title, updated) => ({ graph_id: id, title, created_at: '2026-01-01T00:00:00Z', updated_at: updated });

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
  assert.strictEqual(out[0].title, 'Payments', 'title comes from the most recently edited board');
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
console.log('ok 06-cloud-groups');
