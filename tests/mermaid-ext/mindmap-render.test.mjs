import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, normalizeLayout } from '../../packages/mermaid-ext/mindmap/render.js';
import { normalizeTheme, themePalette } from '../../packages/mermaid-ext/mindmap/themes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const require = createRequire(import.meta.url);
globalThis.BoardThemes = require('../../packages/board/themes/index.js');

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
assert.doesNotMatch(radial.svg, /pele-node/);
assert.ok(radial.model.nodes[0].height >= 56, 'root pill is larger');
assert.ok(radial.model.nodes[0].width >= 128, 'root pill is wider');

const classic = themePalette('classic');
const pastel = themePalette('pastel');
assert.notEqual(classic.root.fill, pastel.root.fill);
assert.equal(classic.root.fill, BoardThemes.get('classic').colors[0]);
assert.doesNotMatch(radial.svg, /2563eb/);

assert.ok(!fs.existsSync(path.join(root, 'packages/mermaid-themes')));

console.log('ok mindmap-render');
