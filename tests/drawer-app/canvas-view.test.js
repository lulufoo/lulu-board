'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require('../../packages/drawer-app/js/00-style-line.js');
const canvas = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/00-canvas-view.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/index.html'), 'utf8');

assert.ok(typeof Style.authoredViewport === 'function');
assert.deepStrictEqual(Style.authoredViewport({ scale: 0.9, cx: 12.4, cy: 8.6 }), {
  scale: 0.9,
  cx: 12,
  cy: 9,
});
assert.strictEqual(Style.authoredViewport({ scale: 1, cx: 0 }), null);
assert.strictEqual(Style.authoredViewport({ scale: 1, x: 10, y: 20 }), null, 'legacy pan-pixel viewport reads as no camera');

assert.ok(/style\.viewport/.test(canvas), 'one viewport field');
assert.ok(/function cameraToPan/.test(canvas), 'camera -> pan is a pure function');
assert.ok(/function panToCamera/.test(canvas), 'pan -> camera is a pure function');
assert.ok(/function worldOriginLayout/.test(canvas), 'measures the world origin inside #preview');
assert.ok(/persistDocumentView/.test(canvas), 'writes viewport into document style');
assert.ok(/forgetDocumentView/.test(canvas), 'Fit clears document viewport');
assert.ok(!/measureDiagramOnCanvas|panAfterScaleAroundPoint/.test(canvas), 'no diagram-rect pan math left');
assert.ok(!/id="boardView/.test(html), 'Style panel does not expose viewport');
assert.ok(!/view_scale|view_pan/.test(canvas), 'does not split viewport into three style keys');

{
  const start = canvas.indexOf('function cameraToPan');
  const end = canvas.indexOf('\nfunction stageSize');
  assert.ok(start >= 0 && end > start, 'camera math is a closed block');
  const api = new Function(canvas.slice(start, end) + '\nreturn { cameraToPan, panToCamera };')();
  const stage = { w: 1000, h: 600 };
  const origin = { x: 40, y: 34 };

  // Camera at the world origin, zoom 1: origin lands at the stage centre.
  assert.deepStrictEqual(api.cameraToPan({ scale: 1, cx: 0, cy: 0 }, stage, origin), { x: 460, y: 266 });
  // Negative world coordinates are ordinary camera targets.
  const pan = api.cameraToPan({ scale: 0.5, cx: -300, cy: -158 }, stage, origin);
  assert.deepStrictEqual(pan, { x: 500 - (-300 + 40) * 0.5, y: 300 - (-158 + 34) * 0.5 });
  // Round trip.
  const back = api.panToCamera(pan.x, pan.y, 0.5, stage, origin);
  assert.ok(Math.abs(back.cx + 300) < 1e-9 && Math.abs(back.cy + 158) < 1e-9 && back.scale === 0.5);
  // Zooming about the stage centre keeps the camera point.
  const zoomed = api.cameraToPan({ scale: 1.08, cx: back.cx, cy: back.cy }, stage, origin);
  const again = api.panToCamera(zoomed.x, zoomed.y, 1.08, stage, origin);
  assert.ok(Math.abs(again.cx + 300) < 1e-9 && Math.abs(again.cy + 158) < 1e-9);
  assert.strictEqual(api.panToCamera(0, 0, 0, stage, origin), null, 'zero scale has no camera');
}

{
  const chrome = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
  assert.ok(/function setCanvasZoom/.test(shell), 'zoom keeps the camera point at the stage centre');
  assert.ok(/setCanvasZoom\(scale \* 1\.08\)/.test(chrome), 'plus zooms about the stage centre');
  assert.ok(/setCanvasZoom\(scale \/ 1\.08\)/.test(chrome), 'minus zooms about the stage centre');
  assert.ok(/setCanvasZoom\(scale \* factor\)/.test(chrome), 'wheel zooms about the stage centre');
  assert.ok(/\$\('#btnZoomReset'\)\.onclick = \(\) => \{ centerView\(\)/.test(chrome), 'percent still fits');
  assert.ok(/BoardRender\.worldBounds\(root\)/.test(shell), 'Fit frames the world bounds');
  assert.ok(/applyCamera\(\{ scale: next, cx: b\.cx, cy: b\.cy \}\)/.test(shell), 'Fit centres the camera on the bounds');
  assert.ok(!/setCanvasScaleAroundDiagram|measureDiagramCenterOnCanvas/.test(shell + chrome), 'no diagram-rect zoom left');
}

console.log('ok canvas-view');
