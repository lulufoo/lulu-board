'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/03-diagram.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'packages/drawer-app/js/03-flowchart.js'), 'utf8');
const board = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'packages/drawer-app/js/01-shell-state.js'), 'utf8');

assert.match(html, /id="btnFlowchartAddSubgraph"/);
assert.match(html, /id="btnFlowchartAddNode"/);
assert.match(html, /id="btnFlowchartLink"/);
assert.match(html, /id="btnFlowchartDelete"/);
assert.match(html, /id="flowchartTitleEditor"/);
assert.match(html, /id="flowchartTypeEditor"/);
assert.match(html, /id="flowchartIdEditor"/);
assert.doesNotMatch(js, /boardTypeEditor/);
assert.doesNotMatch(js, /boardTitleEditor/);
assert.doesNotMatch(js, /boardIdEditor/);
assert.match(css, /html\[data-diagram-kind="flowchart"\] \.flowchart-edit-tools/);
assert.match(js, /FlowchartEdit\.addNode/);
assert.match(js, /FlowchartEdit\.addLink/);
assert.match(js, /FlowchartEdit\.addSubgraph/);
assert.match(js, /FlowchartEdit\.deleteSelection/);
assert.match(js, /FlowchartEdit\.updateNodeKind/);
assert.match(js, /flowchartTypeEditor/);
assert.match(board, /isBoardCanvasKind/);
assert.match(board, /restoreFlowchartSelection/);
assert.match(build, /03-flowchart\.js/);
assert.match(shell, /wrapEditorApi\(typeof FlowchartEdit/);

console.log('ok flowchart-chrome');
