import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const boxJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/box/box.js'), 'utf8');
const boardJs = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/src/kinds/board.js'), 'utf8');

assert.ok(
  /board-item-type-chip[\s\S]{0,220}board-item-type-note[\s\S]{0,80}max-width:\s*var\(--board-item-cap/.test(css),
  'chip/text/note share --board-item-cap'
);
assert.ok(
  /\.board-zone\s*\{[^}]*max-width:\s*var\(--board-box-cap/.test(css),
  '.board-zone uses --board-box-cap'
);
assert.ok(
  !/el\.style\.maxWidth\s*=\s*['"]none['"]/.test(boxJs),
  'box mount does not force maxWidth none'
);
assert.ok(
  /applyBoxRem/.test(boxJs),
  'box mount applies a per-id rem override'
);
assert.ok(/showMaxWidth = isMd \|\| isBoxNode/.test(boardJs), 'You shows Max Width for boxes');
assert.ok(/selectedBoardNode.kind !== "item" && selectedBoardNode.kind !== "box"/.test(boardJs), 'Max Width writes boxes');

console.log('ok item-max-width');
