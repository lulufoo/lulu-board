import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
const itemJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/item/item.js'), 'utf8');
const boardJs = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/src/kinds/board.js'), 'utf8');
const panesJs = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/src/state/props-panes.js'), 'utf8');
const nativeJs = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/src/chrome/native-selects.js'), 'utf8');

assert.ok(
  /data-board-align\^="top"/.test(css) && /data-board-align\^="bottom"/.test(css),
  'item align uses 3x3 data-board-align'
);
assert.ok(/id="board-item-align-field"/.test(html), 'You has Align');
assert.ok(/id="board-item-align-editor"/.test(html), 'Align is a select');
assert.ok(/id="board-item-align-reset"/.test(html), 'Align has Reset');
assert.ok(/ItemAlign\.apply/.test(itemJs), 'item mount applies align');
assert.ok(/setBoardItemAlignField\(!!isItem/.test(boardJs), 'You shows Align for all items');
assert.ok(/board-item-align-field/.test(panesJs), 'You pane counts Align');
assert.ok(/iconFor: alignIcon/.test(nativeJs), 'Align dropdown uses icons');

console.log('ok item-align chrome');
