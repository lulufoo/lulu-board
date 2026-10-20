import assert from 'node:assert/strict';
import { addNode, getNode, deleteNode } from '../../packages/mermaid-ext/flowchart/node.js';
import { addLink, getLink, deleteLink } from '../../packages/mermaid-ext/flowchart/link.js';
import { addSubgraph, getSubgraph, deleteSubgraph } from '../../packages/mermaid-ext/flowchart/subgraph.js';

const source = `flowchart TD
  A[Start]
`;

{
  const added = addNode(source, { id: 'B', label: 'Next' });
  assert.equal(getNode(added.source, 'B').label, 'Next');
  assert.ok(getNode(added.source, 'A'), 'existing node stays');
}

{
  const withB = addNode(source, { id: 'B', label: 'Next' });
  const linked = addLink(withB.source, 'A', 'B', 'go');
  const link = getLink(linked.source, 'A', 'B');
  assert.ok(link, 'added link exists');
  assert.equal(link.label, 'go');
  const gone = deleteLink(linked.source, { kind: 'link', from: 'A', to: 'B' });
  assert.equal(getLink(gone.source, 'A', 'B'), null);
  assert.ok(getNode(gone.source, 'A'));
  assert.ok(getNode(gone.source, 'B'));
}

{
  const grouped = addSubgraph(source, { id: 'G', title: 'Group' });
  const sg = getSubgraph(grouped.source, 'G');
  assert.equal(sg.title, 'Group');
  const gone = deleteSubgraph(grouped.source, { kind: 'subgraph', id: 'G' });
  assert.equal(getSubgraph(gone.source, 'G'), null);
  assert.ok(getNode(gone.source, 'A'), 'nodes outside the subgraph stay');
}

{
  const withB = addNode(source, { id: 'B', label: 'Next' });
  const linked = addLink(withB.source, 'A', 'B');
  const gone = deleteNode(linked.source, { kind: 'node', id: 'B' });
  assert.equal(getNode(gone.source, 'B'), null);
  assert.equal(getLink(gone.source, 'A', 'B'), null);
  assert.ok(getNode(gone.source, 'A'));
}

console.log('ok flowchart-add');
