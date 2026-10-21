import assert from 'node:assert/strict';
import { getDirection, updateDirection, normalizeDirection } from '../../packages/mermaid-ext/flowchart/source.js';
import { addSubgraph, getSubgraph, updateSubgraphDirection } from '../../packages/mermaid-ext/flowchart/subgraph.js';

assert.equal(normalizeDirection('lr'), 'LR');
assert.equal(normalizeDirection('RL'), 'LR');
assert.equal(normalizeDirection('tb'), 'TD');
assert.equal(normalizeDirection('BT'), 'TD');
assert.equal(normalizeDirection(''), 'TD');

{
  const src = '%% title Demo\nflowchart TD\n  A[Start]\n';
  assert.equal(getDirection(src), 'TD');
  const next = updateDirection(src, 'LR');
  assert.equal(getDirection(next.source), 'LR');
  assert.match(next.source, /^%% title Demo\nflowchart LR\n/);
  const back = updateDirection(next.source, 'TD');
  assert.equal(getDirection(back.source), 'TD');
}

{
  const src = 'graph TB\n  A-->B\n';
  assert.equal(getDirection(src), 'TD');
  const next = updateDirection(src, 'lr');
  assert.match(next.source, /^graph LR\n/);
}

{
  const grouped = addSubgraph('flowchart TD\n  A[Start]\n', { id: 'G', title: 'Group' });
  const sg = getSubgraph(grouped.source, 'G');
  assert.equal(sg.authoredDirection, '');
  assert.equal(sg.direction, 'TD');
  const turned = updateSubgraphDirection(grouped.source, { kind: 'subgraph', id: 'G' }, 'LR');
  const after = getSubgraph(turned.source, 'G');
  assert.equal(after.authoredDirection, 'LR');
  assert.equal(after.direction, 'LR');
  assert.match(turned.source, /subgraph G\["Group"\]\n\s+direction LR\n/);
  assert.equal(getDirection(turned.source), 'TD', 'group direction does not rewrite the header');
  const again = updateSubgraphDirection(turned.source, { kind: 'subgraph', id: 'G' }, 'TD');
  assert.match(again.source, /direction TD/);
  assert.equal(getSubgraph(again.source, 'G').direction, 'TD');
}

console.log('ok flowchart-direction');
