import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from '../../packages/board-themes/index.js';
import { render, normalizeLayout } from '../../packages/mermaid-ext/mindmap/render.js';
import { normalizeTheme, themePalette } from '../../packages/mermaid-ext/mindmap/themes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');

const source = `mindmap
  Root
    Left
    Right
      Leaf
`;

assert.equal(normalizeLayout('logic'), 'logic');
assert.equal(normalizeLayout('map'), 'radial');
assert.equal(normalizeTheme('classic'), 'classic');
assert.equal(normalizeTheme('minimal'), 'classic');
assert.equal(normalizeTheme('slate'), 'pastel');
assert.equal(normalizeTheme('kami'), 'default');

const radial = render(source, { layout: 'radial', theme: 'default', id: 'mm-r' });
const logic = render(source, { layout: 'logic', theme: 'default', id: 'mm-l' });
assert.equal(radial.layout, 'radial');
assert.equal(logic.layout, 'logic');
assert.match(radial.svg, /data-mindmap-layout="radial"/);
assert.match(logic.svg, /data-mindmap-layout="logic"/);
assert.notEqual(radial.svg, logic.svg, 'same source, two layouts');
assert.match(radial.svg, /class="mindmap-node/);
assert.match(radial.svg, /data-path="0"/);
assert.match(radial.svg, /data-path="1\.0"/);
assert.match(radial.svg, /class="mindmap-add"/);
assert.match(radial.svg, /node-bkg/);
assert.match(radial.svg, /rx="/);
assert.doesNotMatch(radial.svg, /<style[\s>]/);
assert.match(radial.svg, /class="node-bkg node-default"[^>]*fill="/);
assert.match(radial.svg, /class="mindmap-add-zone-hit"[^>]*fill="none"/);
assert.doesNotMatch(radial.svg, /pele-node/);
assert.ok(radial.model.nodes[0].height >= 56, 'root pill is larger');
assert.ok(radial.model.nodes[0].width >= 128, 'root pill is wider');
assert.match(radial.svg, /stroke-width="2"/, 'root stroke is heavier');
assert.match(radial.svg, /stroke-width="1"/, 'branch stroke stays thin');
assert.notEqual(themePalette('default').root.stroke, themePalette('default').sections[0].stroke);

const classic = themePalette('classic');
const pastel = themePalette('pastel');
assert.notEqual(classic.root.fill, pastel.root.fill);
assert.equal(classic.root.fill, get('classic').colors[0]);
assert.doesNotMatch(radial.svg, /2563eb/);

assert.ok(!fs.existsSync(path.join(root, 'packages/mermaid-themes')));

console.log('ok mindmap-render');
