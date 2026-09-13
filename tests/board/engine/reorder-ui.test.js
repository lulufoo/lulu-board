'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skill/drawer/SKILL.md'), 'utf8');

assert.ok(html.includes('id="board-order-field"'), 'Props has Order field');
assert.ok(html.includes('id="btn-board-order-prev"'), 'Props has prev order button');
assert.ok(html.includes('id="btn-board-order-next"'), 'Props has next order button');
assert.ok(/mode:\s*"reorder"/.test(boardJs), 'nested drag uses reorder mode');
assert.ok(!/board-reparent-target/.test(boardJs), 'canvas no longer highlights reparent targets');
assert.ok(!/Alt-drag onto a box to nest/.test(boardJs), 'Props hint no longer teaches Alt reparent');
assert.ok(/nested reorder/.test(skill), 'drawer SKILL names nested reorder');
assert.ok(/nested siblings \(arrows\)/.test(skill), 'drawer SKILL names sibling arrow select');
assert.ok(/function boardNudgeSelection/.test(boardJs), 'arrow keys can move nested selection');
assert.ok(!/Alt-drag reparent/.test(skill), 'drawer SKILL drops Alt-drag reparent');

console.log('ok reorder-ui');
