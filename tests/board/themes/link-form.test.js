'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Themes = require('../../../packages/board/themes');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../..', p), 'utf8');

// default theme: warm brown line + deep brown label; the other packs keep their own colours
assert.strictEqual(Themes.get('default').edgeStroke, '#7a5c3c');
assert.strictEqual(Themes.get('default').edgeLabel, '#5a4330');
assert.notStrictEqual(Themes.get('classic').edgeStroke, '#7a5c3c');

const render = read('packages/board/engine/board-render.js');
// small rounded solid triangle, same shape both directions
assert.match(render, /markerWidth', '6\.4'/);
assert.match(render, /stroke-linejoin', 'round'/);

// selection is brand pink, label weight 600 / 11px
assert.match(read('packages/drawer-app/js/02-board.js'), /BOARD_EDGE_SELECTED_COLOR = "#db4c84"/);
const css = read('packages/drawer-app/css/03-diagram.css');
assert.match(css, /\.board-edge-label \{[^}]*font-weight: 600/);
assert.match(css, /\.board-edge-label \{[^}]*fill: var\(--board-edge-label, #5a4330\)/);
console.log('ok link-form');

// dashed links: 5/4 round-capped strokes, arrow stays solid (markers ignore dasharray)
assert.match(render, /dash: dashed \? '5 4' : ''/);
assert.match(render, /path\.setAttribute\('stroke-linecap', 'round'\)/);
