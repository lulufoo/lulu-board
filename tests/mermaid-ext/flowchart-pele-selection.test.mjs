import assert from 'node:assert/strict';
import { parseEdgeDomId, selectionFromDom } from '../../packages/mermaid-ext/flowchart/selection.js';

const source = `flowchart TD
  A[Start] --> B{Fork?}
  B -->|yes| C[Pele]
  subgraph G[Group]
    C --> D[End]
  end
`;

{
  const hit = parseEdgeDomId('L_A_B_0', source);
  assert.equal(hit.kind, 'link');
  assert.equal(hit.from, 'A');
  assert.equal(hit.to, 'B');
  assert.equal(hit.key, 'link:A:B');
}

function mock(kind, dataId) {
  const el = {
    id: '',
    getAttribute(name) {
      if (name === 'data-id' || name === 'data-edge-dom-id') return dataId;
      return '';
    },
    querySelector() { return null; },
    closest(sel) {
      const parts = String(sel).split(',').map((s) => s.trim());
      const map = {
        node: 'g.pele-node',
        edge: 'g.pele-edge',
        label: 'g.pele-edge-label',
        cluster: 'g.pele-cluster',
        title: 'g.pele-cluster-title',
        hit: 'path.mermaid-edge-hit',
      };
      return parts.includes(map[kind]) ? el : null;
    },
  };
  return el;
}

{
  const node = selectionFromDom(mock('node', 'A'), source);
  assert.equal(node.kind, 'node');
  assert.equal(node.id, 'A');
}

{
  const edge = selectionFromDom(mock('edge', 'L_B_C_0'), source);
  assert.equal(edge.kind, 'link');
  assert.equal(edge.from, 'B');
  assert.equal(edge.to, 'C');
}

{
  const label = selectionFromDom(mock('label', 'L_B_C_0'), source);
  assert.equal(label.kind, 'link');
  assert.equal(label.from, 'B');
}

{
  const cluster = selectionFromDom(mock('cluster', 'G'), source);
  assert.equal(cluster.kind, 'subgraph');
  assert.equal(cluster.id, 'G');
}

{
  const title = selectionFromDom(mock('title', 'G'), source);
  assert.equal(title.kind, 'subgraph');
  assert.equal(title.id, 'G');
}

{
  const hit = selectionFromDom(mock('hit', 'L_C_D_0'), source);
  assert.equal(hit.kind, 'link');
  assert.equal(hit.from, 'C');
  assert.equal(hit.to, 'D');
}
