'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-vela.js'), 'utf8');
const boardEdit = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
assert.match(build, /02-vela\.js/, 'host file is in the drawer bundle');
assert.ok(build.indexOf("'02-vela.js'") < build.indexOf("'02-board.js'"), 'host file concatenates before Board edit');
assert.doesNotMatch(boardEdit, /function renderBoard/, 'Board edit file no longer owns render');
assert.match(boardJs, /function renderFlowchart/, 'flowchart render path exists');
assert.match(boardJs, /function refuseUnsupportedMermaid/, 'unsupported mermaid is refused');
assert.match(boardJs, /Only flowchart can be rendered/, 'refuse copy is locked');
assert.match(boardJs, /kind === "flowchart"/, 'renderBoard dispatches flowchart');
assert.match(boardJs, /kind === "mermaid-unsupported"/, 'renderBoard dispatches unsupported mermaid');

console.log('ok kind-route');
