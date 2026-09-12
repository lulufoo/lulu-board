'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const boxJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/box/board-box.js'), 'utf8');

assert.ok(
  /board-item-type-chip[\s\S]{0,220}board-item-type-note[\s\S]{0,80}max-width:\s*var\(--board-item-cap/.test(css),
  'chip/text/note share --board-item-cap'
);
assert.ok(
  /\.board-zone\s*\{[^}]*max-width:\s*none/.test(css),
  '.board-zone has no unified rem cap'
);
assert.ok(
  /el\.style\.maxWidth\s*=\s*['"]none['"]/.test(boxJs),
  'box mount forces maxWidth none'
);

console.log('ok item-max-width');
