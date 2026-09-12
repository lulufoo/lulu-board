'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const box = fs.readFileSync(path.join(__dirname, '../../../packages/board/box/board-box.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');

assert.ok(/board-layout-halo/.test(box), 'layout mount adds a halo node');
assert.ok(/isLayout/.test(box) && /board-layout-halo/.test(box), 'halo is layout-only');
assert.ok(/\.board-layout-halo\s*\{/.test(css), 'halo has a hit ring');
assert.ok(/inset:\s*-8px/.test(css), 'halo extends 8px outside the layout');
assert.ok(/:hover:not\(:has\(>\s*\.box-content:hover\)\)/.test(css), 'hover outline only on the ring');

console.log('ok layout-hit-halo');
