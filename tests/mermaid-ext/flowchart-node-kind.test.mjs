import assert from 'node:assert/strict';
import { getNode, updateNodeKind } from '../../packages/mermaid-ext/flowchart/node.js';

const inline = `flowchart LR
  Start([本轮只设计 /mermaid]) --> Q{图上点选编辑?}
  Q -->|拆掉| A[继续 Mermaid.js]
`;

{
  const q = getNode(inline, 'Q');
  assert.equal(q.shape, 'diamond', 'inline Q{...} is a diamond');
  assert.equal(q.nodeKind, 'judgment', 'diamond maps to judgment, the last Type');
  assert.equal(q.label, '图上点选编辑?');
}

{
  const start = getNode(inline, 'Start');
  assert.equal(start.shape, 'stadium');
  assert.equal(start.nodeKind, 'start');
}

{
  const next = updateNodeKind(inline, { kind: 'node', id: 'Q' }, 'default');
  const q = getNode(next.source, 'Q');
  assert.equal(q.shape, 'rect', 'Type default rewrites the inline diamond');
  assert.equal(q.nodeKind, 'default');
  assert.equal(q.label, '图上点选编辑?', 'label is kept');
  assert.match(next.source, /Q\["图上点选编辑\?"\]/);
  assert.doesNotMatch(next.source, /Q\{图上点选编辑\?\}/);
}

{
  const boxed = `flowchart LR
  Q{"图上点选编辑?"}
  Q --> A[End]
`;
  const q = getNode(boxed, 'Q');
  assert.equal(q.nodeKind, 'judgment');
  const next = updateNodeKind(boxed, { kind: 'node', id: 'Q' }, 'start');
  assert.equal(getNode(next.source, 'Q').shape, 'stadium');
}

console.log('ok flowchart-node-kind');
