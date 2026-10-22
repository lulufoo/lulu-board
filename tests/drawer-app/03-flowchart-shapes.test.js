'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const Shapes = require('../../packages/drawer-app/js/03-flowchart-shapes.js');

assert.strictEqual(Shapes.BOX_RX, 4, 'default box stays a box, not a stadium');
assert.strictEqual(Shapes.DIAMOND_R, 6, 'diamond corner matches Board rhombus');
assert.ok(Shapes.BOX_RX < 12, 'box radius must not use the Board card 12px');

const attrs = { style: 'rx:var(--_r);fill:var(--_s)' };
const rect = {
  getAttribute(k) { return attrs[k] === undefined ? null : attrs[k]; },
  setAttribute(k, v) { attrs[k] = String(v); },
  removeAttribute(k) { delete attrs[k]; },
};
Shapes.bakeDefaultRectRadius(rect, Shapes.BOX_RX);
assert.strictEqual(attrs.rx, '4');
assert.strictEqual(attrs.ry, '4');
assert.doesNotMatch(String(attrs.style || ''), /rx:/, 'CSS rx:var(--_r) cannot override the baked corner');

const points = '0,-41 65.61,0 0,41.01 -65.61,0';
const geo = Shapes.diamondPathFromPoints(points);
assert.ok(geo && geo.d, 'diamond becomes a path');
assert.match(geo.d, /^M/);
assert.match(geo.d, / Q/);
assert.match(geo.d, /Z$/);
assert.ok(geo.r <= 6);
const halo = Shapes.diamondHaloPath(geo.cx, geo.cy, geo.a, geo.b, geo.r, 2.5);
assert.ok(halo);
assert.notStrictEqual(halo, geo.d, 'halo is an offset of the rounded diamond');

const peleSrc = fs.readFileSync(path.join(root, 'packages/drawer-app/vendor/pele.global.js'), 'utf8');
const ctx = { console, setTimeout, clearTimeout };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.runInNewContext(peleSrc, ctx);
const svg = ctx.pele.render(
  'flowchart TD\n  A[Default box]\n  B([Start stadium])\n  C{Diamond}\n  A --> B --> C\n',
  { fontSize: 16, autoDirection: false, responsive: false }
).svg;
assert.match(svg, /pele-shape-rect[^>]*>[\s\S]*?<rect[^>]*style="rx:var\(--_r\)"/);
assert.match(svg, /pele-shape-stadium[^>]*>[\s\S]*?<rect[^>]*rx="24"/);
assert.match(svg, /pele-shape-diam[^>]*>[\s\S]*?<polygon /);
assert.doesNotMatch(svg, /pele-shape-stadium[^>]*>[\s\S]*?style="rx:var\(--_r\)"/);

const board = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-diagram.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
assert.match(board, /FlowchartShapes\.polishFlowchartNodeShapes/, 'render bakes corners before selection');
assert.match(board, /FlowchartTypeScale\.applyToRoot/, 'render applies the four font rungs');
assert.match(build, /03-flowchart-shapes\.js/, 'shapes file is in the drawer bundle');
assert.strictEqual(typeof Shapes.installFlowchartEdgeHits, 'function', 'edge hits are part of polish');
assert.match(
  fs.readFileSync(path.join(root, 'packages/drawer-app/js/03-flowchart-shapes.js'), 'utf8'),
  /mermaid-edge-hit/,
  'hit class matches selectionFromDom'
);

console.log('ok flowchart-shapes');
