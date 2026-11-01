import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/src/kinds/board.js'), 'utf8');

assert.ok(!html.includes('id="board-order-field"'), 'Props has no Order field');
assert.ok(!html.includes('id="btn-board-order-prev"'), 'Props has no prev order button');
assert.ok(!html.includes('id="btn-board-order-next"'), 'Props has no next order button');
assert.ok(/mode:\s*"reorder"/.test(boardJs), 'nested drag uses reorder mode');
assert.ok(!/board-reparent-target/.test(boardJs), 'canvas no longer highlights reparent targets');
assert.ok(!/Alt-drag onto a box to nest/.test(boardJs), 'Props hint no longer teaches Alt reparent');
assert.ok(/function boardNudgeSelection/.test(boardJs), 'arrow keys can move nested selection');

console.log('ok reorder-ui');
