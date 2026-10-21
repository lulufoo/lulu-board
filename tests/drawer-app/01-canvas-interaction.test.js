'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Interaction = require('../../packages/drawer-app/js/01-canvas-interaction.js');

assert.ok(Interaction.wheelFactor(0, 0) === 1, 'zero wheel keeps scale');
assert.ok(Interaction.wheelFactor(100, 0) < 1, 'scroll down zooms out');
assert.ok(Interaction.wheelFactor(-100, 0) > 1, 'scroll up zooms in');

assert.ok(Interaction.isBlockedTarget({ closest: (sel) => sel.indexOf('.vela-dock') >= 0 }), 'chrome is blocked');
assert.ok(!Interaction.isBlockedTarget({ closest: () => null }), 'blank stage is not a hit');
assert.ok(!Interaction.isBlockedTarget(null), 'missing target is blank');

let boardClear = 0;
let flowClear = 0;
Interaction.registerKind('board', {
  isHit: (t) => !!(t && t.kind === 'board-item'),
  clear: function () { boardClear += 1; },
});
Interaction.registerKind('flowchart', {
  isHit: (t) => !!(t && t.kind === 'pele-node'),
  clear: function () { flowClear += 1; },
});
assert.ok(Interaction.isBlockedTarget({ kind: 'pele-node', closest: () => null }), 'flowchart hit is registered');
assert.ok(!Interaction.isBlockedTarget({ closest: () => null }), 'blank is still not a hit');
let closed = 0;
globalThis.closePropsPanel = function () { closed += 1; };
Interaction.leaveBlank();
assert.strictEqual(boardClear, 1, 'default kind is board');
assert.strictEqual(flowClear, 0, 'inactive kind does not clear');
assert.strictEqual(closed, 1, 'blank click hides Properties');
delete globalThis.closePropsPanel;

const build = fs.readFileSync(path.join(__dirname, '../../scripts/drawer-app-build/build.mjs'), 'utf8');
const boot = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-canvas-interaction.js'), 'utf8');
assert.match(build, /01-canvas-interaction\.js/, 'module is in the drawer bundle');
assert.doesNotMatch(boot, /CanvasInteraction\.setOnBlank/, 'chrome-boot does not pick the kind clear');
assert.doesNotMatch(boot, /clearFlowchartInteraction|clearBoardSelection/, 'chrome-boot has no kind blank path');
assert.doesNotMatch(boot, /stageEl\.addEventListener\('wheel'/, 'chrome-boot does not own wheel zoom');
assert.doesNotMatch(boot, /stageEl\.addEventListener\('pointerdown'/, 'chrome-boot does not own blank pan');
assert.match(src, /setCanvasZoom\(scale \* factor\)/, 'wheel still uses the live camera');
assert.match(src, /panX = event\.clientX - panOrigin\.x/, 'pan still writes panX / panY');
const downAt = src.indexOf('function onPointerDown');
const moveAt = src.indexOf('function onPointerMove');
const endAt = src.indexOf('function endPan');
assert.ok(downAt >= 0 && moveAt > downAt && endAt >= 0);
assert.doesNotMatch(src.slice(downAt, moveAt), /leaveBlank|hideBlankProps|closePropsPanel/, 'pan start does not hide Properties');
assert.match(src.slice(endAt), /!moved && leaveIfStill\) leaveBlank/, 'blank click without move still leaves');
assert.match(src, /function hideBlankProps/, 'hide is on the shared canvas module');
assert.match(src, /\.vela-dock-resize/, 'dock resize is chrome, not a blank leave');
assert.doesNotMatch(src, /let scale|var scale =|function applyTransform/, 'no second camera stack');
assert.match(src, /addEventListener\("dblclick", onDblClick\)/, 'blank dblclick is on the shared module');
assert.match(src, /openBlankProps/, 'blank dblclick opens Props');
let props = 0;
globalThis.openPropsPanel = function () { props += 1; };
Interaction.openBlankProps();
assert.strictEqual(props, 1, 'blank dblclick calls openPropsPanel');
delete globalThis.openPropsPanel;

const board = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/02-board.js'), 'utf8');
const flow = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/03-flowchart.js'), 'utf8');
assert.match(board, /registerKind\("board"/, 'Board registers hit / clear');
assert.doesNotMatch(board, /previewEl\.addEventListener\("pointerdown"/, 'Board blank pointerdown is not a second path');
assert.doesNotMatch(flow, /else clearFlowchartInteraction\(\)/, 'flowchart miss is not a second blank path');
assert.match(board, /if \(!hit \|\| !canvas\.contains\(hit\)\) return;/, 'Board blank dblclick does not open Props');
assert.match(flow, /previewEl\.addEventListener\("dblclick"/, 'flowchart hit dblclick inspects');
assert.doesNotMatch(flow, /openBlankProps/, 'flowchart does not own blank props');
assert.doesNotMatch(flow, /closePropsPanel/, 'flowchart clear does not hide Properties');
assert.doesNotMatch(board, /closePropsPanel/, 'Board clear does not hide Properties');
assert.doesNotMatch(flow, /\.top-float, \.vela-dock, \.zoom-float/, 'dock resize is not a flowchart leave');

console.log('ok canvas-interaction');
