'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
assert.match(boardJs, /function renderFlowchart/, 'flowchart render path exists');
assert.match(boardJs, /function refuseUnsupportedMermaid/, 'unsupported mermaid is refused');
assert.match(boardJs, /Only flowchart can be rendered/, 'refuse copy is locked');
assert.match(boardJs, /kind === "flowchart"/, 'renderBoard dispatches flowchart');
assert.match(boardJs, /kind === "mermaid-unsupported"/, 'renderBoard dispatches unsupported mermaid');

console.log('ok kind-route');
