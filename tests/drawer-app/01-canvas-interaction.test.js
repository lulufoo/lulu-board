'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Interaction = require('../../packages/drawer-app/js/01-canvas-interaction.js');

assert.ok(Interaction.wheelFactor(0, 0) === 1, 'zero wheel keeps scale');
assert.ok(Interaction.wheelFactor(100, 0) < 1, 'scroll down zooms out');
assert.ok(Interaction.wheelFactor(-100, 0) > 1, 'scroll up zooms in');

assert.ok(Interaction.isBlockedTarget({ closest: (sel) => sel.indexOf('g.pele-node') >= 0 }), 'Pele node is a hit');
assert.ok(!Interaction.isBlockedTarget({ closest: () => null }), 'blank stage is not a hit');
assert.ok(!Interaction.isBlockedTarget(null), 'missing target is blank');

let blank = 0;
Interaction.setOnBlank(function () { blank += 1; });
Interaction.leaveBlank();
assert.strictEqual(blank, 1, 'kinds supply the clear hook');

const build = fs.readFileSync(path.join(__dirname, '../../scripts/drawer-app-build/build.mjs'), 'utf8');
const boot = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-canvas-interaction.js'), 'utf8');
assert.match(build, /01-canvas-interaction\.js/, 'module is in the drawer bundle');
assert.match(boot, /CanvasInteraction\.setOnBlank/, 'chrome-boot only registers the clear hook');
assert.doesNotMatch(boot, /stageEl\.addEventListener\('wheel'/, 'chrome-boot does not own wheel zoom');
assert.doesNotMatch(boot, /stageEl\.addEventListener\('pointerdown'/, 'chrome-boot does not own blank pan');
assert.match(src, /setCanvasZoom\(scale \* factor\)/, 'wheel still uses the live camera');
assert.match(src, /panX = event\.clientX - panOrigin\.x/, 'pan still writes panX / panY');
assert.doesNotMatch(src, /let scale|var scale =|function applyTransform/, 'no second camera stack');
assert.doesNotMatch(src, /dblclick|openPropsPanel/, 'blank dblclick is the next Issue');

console.log('ok canvas-interaction');
