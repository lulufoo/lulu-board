'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const shell = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
const board = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/02-board.js'), 'utf8');
const boot = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');

assert.ok(/function applyRestoredBoardView/.test(shell), 'restore helper');
assert.ok(/boardViewId/.test(shell), 'persist per-board view id');
assert.ok(/opts\.restoreView\) \{\s*applyRestoredBoardView\(\)/.test(board), 'renderBoard restore uses helper');
assert.ok(/applyRestoredBoardView\(\)/.test(boot), 'setMode skipBoard uses helper');

console.log('ok refresh-restore-fit');
