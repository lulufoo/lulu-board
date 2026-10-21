'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const tokens = read('packages/drawer-app/css/04-board-form.css');
const css = read('packages/drawer-app/css/03-diagram.css');
const board = read('packages/drawer-app/js/02-board.js');
const flow = read('packages/drawer-app/js/03-flowchart.js');

assert.match(tokens, /--canvas-ring:\s*var\(--bf-ring\)/, 'selected ring aliases Board pink');
assert.match(tokens, /--canvas-ring-soft:\s*var\(--bf-ring-soft\)/, 'hover ring aliases Board soft pink');
assert.match(tokens, /--canvas-ring-width:\s*2px/, 'selected ring is 2px');
assert.match(tokens, /--canvas-ring-offset:\s*2px/, 'selected ring offset is shared');

assert.match(css, /\.canvas-selected:not\(\.board-item-diamond\):not\(\.board-diamond\) \{[\s\S]*outline:\s*var\(--canvas-ring-width/, 'HTML selected ring is one class');
assert.match(css, /\.canvas-hover:not\(\.canvas-selected\)[\s\S]*outline:\s*1px dashed var\(--canvas-ring-soft/, 'hover is 1px dashed, not the selected solid');
assert.doesNotMatch(css, /\.canvas-hover[\s\S]{0,120}outline:\s*2px solid/, 'hover is not a 2px solid twin of selected');
assert.match(css, /\.flowchart-selection-halo \{[\s\S]*stroke:\s*var\(--canvas-ring/, 'flowchart selected halo reads the same token');
assert.match(css, /\.canvas-hover-halo \{[\s\S]*stroke:\s*var\(--canvas-ring-soft/, 'flowchart hover halo reads the soft token');
assert.match(css, /\.canvas-hover-halo \{[\s\S]*stroke-dasharray/, 'flowchart hover halo is dashed');
assert.doesNotMatch(css, /\.flowchart-selection-halo \{[\s\S]*stroke:\s*var\(--accent/, 'flowchart halo no longer uses --accent');
assert.doesNotMatch(css, /\.board-selection \{[^}]*outline:\s*2px solid var\(--bf-ring/, 'Board selected outline left the old class');

assert.match(board, /classList\.add\("board-selection", "canvas-selected"\)/, 'Board hangs the public selected class');
assert.match(flow, /classList\.add\("flowchart-selection", "canvas-selected"\)/, 'Flowchart hangs the public selected class');
assert.match(flow, /function applyFlowchartHover/, 'Flowchart has hover');
assert.match(flow, /classList\.add\("canvas-hover"\)/, 'Flowchart hangs the public hover class');
assert.match(flow, /paintFlowchartHalo\(g, "canvas-hover-halo"\)/, 'SVG hover uses a token halo, not outline');
assert.match(flow, /if \(g\.classList\.contains\("canvas-selected"\) \|\| g\.classList\.contains\("flowchart-selection"\)\) return/, 'selected nodes do not also hover');

console.log('ok canvas-ring');
