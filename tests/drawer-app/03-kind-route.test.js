'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-diagram.js'), 'utf8');
const boardEdit = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
assert.match(build, /02-diagram\.js/, 'host file is in the drawer bundle');
assert.ok(build.indexOf("'02-diagram.js'") < build.indexOf("'02-board.js'"), 'host file concatenates before Board edit');
assert.doesNotMatch(boardEdit, /function renderDiagram/, 'Board edit file no longer owns render');
assert.match(boardJs, /function renderFlowchart/, 'flowchart render path exists');
assert.match(boardJs, /function renderMindmap/, 'mindmap render path exists');
assert.match(boardJs, /function refuseUnsupportedMermaid/, 'unsupported mermaid is refused');
assert.match(boardJs, /This diagram type cannot be rendered/, 'refuse copy is locked');
assert.doesNotMatch(boardJs, /Only flowchart and mindmap can be rendered/, 'Design is no longer in the refuse copy');
assert.match(boardJs, /kind === "flowchart"/, 'renderDiagram dispatches flowchart');
assert.match(boardJs, /kind === "mindmap"/, 'renderDiagram dispatches mindmap');
assert.match(boardJs, /isDesignKind\(kind\)/, 'renderDiagram dispatches Design through Pele');
assert.match(boardJs, /function renderDesignPele/, 'Design has a shared Pele path');
assert.match(boardJs, /function paintPeleSvg/, 'flowchart and Design share Pele paint');
assert.match(boardJs, /kind === "mermaid-unsupported"/, 'renderDiagram dispatches unsupported mermaid');
assert.match(boardJs, /MindmapEdit\.render/, 'mindmap uses the custom SVG renderer');
assert.doesNotMatch(boardJs, /function renderMindmap[\s\S]*window\.pele/, 'mindmap does not render through Pele');

console.log('ok kind-route');
