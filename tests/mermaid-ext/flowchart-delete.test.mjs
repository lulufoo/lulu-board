import assert from 'node:assert/strict';
import { deleteNode, getNode } from '../../packages/mermaid-ext/flowchart/node.js';
import { deleteLink, getLink } from '../../packages/mermaid-ext/flowchart/link.js';
import { collectIds } from '../../packages/mermaid-ext/flowchart/source.js';

const source = `flowchart LR
  Start(["本轮只设计 /mermaid"]) --> Q{"图上点选编辑?"}
  Q -->|留着 渲染器不动| Keep["继续 Mermaid.js"]
  Q -->|拆掉| Drop["源码加预览"]
  Q -->|留着 渲染改 Pele| Pele["重写点选层"]
`;

{
  const result = deleteLink(source, { kind: 'link', from: 'Q', to: 'Keep' });
  assert.equal(getLink(result.source, 'Q', 'Keep'), null, 'deleted link is gone');
  assert.ok(getNode(result.source, 'Q'), 'link delete keeps the source node');
  assert.ok(getNode(result.source, 'Keep'), 'link delete keeps the target node');
  assert.ok(getLink(result.source, 'Q', 'Drop'), 'other links stay');
  assert.ok(collectIds(result.source).Start, 'unrelated nodes stay');
}

{
  const result = deleteNode(source, { kind: 'node', id: 'Q' });
  assert.equal(getNode(result.source, 'Q'), null, 'deleted node is gone');
  assert.equal(getLink(result.source, 'Start', 'Q'), null, 'incoming link is gone');
  assert.equal(getLink(result.source, 'Q', 'Keep'), null, 'outgoing labeled link is gone');
  assert.equal(getLink(result.source, 'Q', 'Drop'), null, 'other outgoing link is gone');
  assert.equal(getLink(result.source, 'Q', 'Pele'), null, 'third outgoing link is gone');
  assert.ok(getNode(result.source, 'Start'), 'related nodes stay after node delete');
  assert.ok(getNode(result.source, 'Keep'), 'target of deleted link stays');
  assert.ok(getNode(result.source, 'Drop'), 'other targets stay');
  assert.ok(getNode(result.source, 'Pele'), 'third target stays');
}

{
  const inline = `flowchart LR
  A["Start"] --> B["End"]
`;
  const lostLink = deleteLink(inline, { kind: 'link', from: 'A', to: 'B' });
  assert.equal(getLink(lostLink.source, 'A', 'B'), null);
  assert.ok(getNode(lostLink.source, 'A'), 'inline source node survives link delete');
  assert.ok(getNode(lostLink.source, 'B'), 'inline target node survives link delete');

  const lostNode = deleteNode(inline, { kind: 'node', id: 'A' });
  assert.equal(getNode(lostNode.source, 'A'), null);
  assert.equal(getLink(lostNode.source, 'A', 'B'), null);
  assert.ok(getNode(lostNode.source, 'B'), 'inline target survives source-node delete');
  assert.equal(getNode(lostNode.source, 'B').label, 'End');
}

console.log('ok flowchart-delete');
