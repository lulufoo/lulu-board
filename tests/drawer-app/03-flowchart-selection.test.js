import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Shapes = require('../../packages/drawer-app/src/kinds/flowchart-shapes.js').default;

function el(tag, attrs, kids) {
  const node = {
    tagName: tag,
    attrs: Object.assign({}, attrs),
    kids: kids || [],
    parentNode: null,
    className: String((attrs && attrs.class) || ''),
    getAttribute(name) { return this.attrs[name] == null ? null : String(this.attrs[name]); },
    setAttribute(name, value) { this.attrs[name] = String(value); if (name === 'class') this.className = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    cloneNode() { return el(this.tagName, Object.assign({}, this.attrs)); },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => {
        if (match(n, sel)) out.push(n);
        (n.kids || []).forEach(walk);
      };
      (this.kids || []).forEach(walk);
      return out;
    },
    insertBefore(child, ref) {
      child.parentNode = this;
      const i = this.kids.indexOf(ref);
      if (i < 0) this.kids.push(child);
      else this.kids.splice(i, 0, child);
      return child;
    },
  };
  (node.kids || []).forEach((k) => { k.parentNode = node; });
  return node;
}

function match(n, sel) {
  if (sel === 'path.mermaid-edge-hit') return n.tagName === 'path' && n.className === 'mermaid-edge-hit';
  if (sel === 'g.pele-edge') return n.tagName === 'g' && /\bpele-edge\b/.test(n.className);
  if (sel === 'path:not(.pele-marker)' || sel === 'path') return n.tagName === 'path' && n.className !== 'pele-marker';
  return false;
}

const painted = el('path', { class: 'edge', id: 'L_A_B_0-path', 'marker-end': 'url(#m)', style: 'stroke:#333', d: 'M0 0 L10 0' });
const edge = el('g', { class: 'pele-edge', 'data-id': 'L_A_B_0', id: 'L_A_B_0' }, [painted]);
const root = el('svg', {}, [edge]);

Shapes.installFlowchartEdgeHits(root);
const hits = root.querySelectorAll('path.mermaid-edge-hit');
assert.strictEqual(hits.length, 1, 'one hit under the painted path');
assert.strictEqual(hits[0].getAttribute('stroke'), 'transparent');
assert.strictEqual(hits[0].getAttribute('data-edge-dom-id'), 'L_A_B_0');
assert.ok(!hits[0].getAttribute('style'), 'hit does not copy painted stroke');
assert.strictEqual(edge.kids[0], hits[0], 'hit sits under the painted path');
assert.strictEqual(edge.kids[1], painted);

const js = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/src/kinds/flowchart.js'), 'utf8');
assert.match(js, /function clearFlowchartInteraction/);
assert.match(js, /function applyFlowchartSelectionVisual/);
assert.doesNotMatch(js, /path\.style\.stroke\s*=/);
assert.doesNotMatch(js, /setAttribute\("stroke", accent\)/);

console.log('ok flowchart-selection');
