'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require('../../packages/drawer-app/js/00-style-line.js');
const canvas = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/00-canvas-view.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/index.html'), 'utf8');

assert.ok(typeof Style.authoredViewport === 'function');
assert.deepStrictEqual(Style.authoredViewport({ scale: 0.9, x: 12.4, y: 8.6 }), {
  scale: 0.9,
  x: 12,
  y: 9,
});
assert.strictEqual(Style.authoredViewport({ scale: 1, x: 0 }), null);

assert.ok(/style\.viewport/.test(canvas), 'one viewport field');
assert.ok(/measureDiagramOnCanvas/.test(canvas), 'measures diagram vs stage');
assert.ok(/measureDiagramCenterOnCanvas/.test(canvas), 'measures diagram center vs stage');
assert.ok(/panAfterScaleAroundPoint/.test(canvas), 'keeps a point fixed when scale changes');
assert.ok(/persistDocumentView/.test(canvas), 'writes viewport into document style');
assert.ok(/forgetDocumentView/.test(canvas), 'Fit clears document viewport');
assert.ok(!/id="boardView/.test(html), 'Style panel does not expose viewport');
assert.ok(!/view_scale|view_pan/.test(canvas), 'does not split viewport into three style keys');

{
  const start = canvas.indexOf('function panAfterScaleAroundPoint');
  const end = canvas.indexOf('\nfunction readDocumentView');
  assert.ok(start >= 0 && end > start, 'panAfterScaleAroundPoint is a closed function');
  const panAfterScaleAroundPoint = new Function(canvas.slice(start, end) + '\nreturn panAfterScaleAroundPoint;')();
  assert.deepStrictEqual(panAfterScaleAroundPoint(0, 0, 1, 2, 100, 50), { x: -100, y: -50 });
  const next = panAfterScaleAroundPoint(12, 20, 0.9, 0.9 * 1.08, 200, 150);
  assert.ok(Math.abs(next.x - (200 - (200 - 12) * 1.08)) < 1e-9);
  assert.ok(Math.abs(next.y - (150 - (150 - 20) * 1.08)) < 1e-9);
}

{
  const chrome = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
  const shell = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
  assert.ok(/function setCanvasScaleAroundDiagram/.test(shell), 'zoom adjusts pan around the diagram');
  assert.ok(/setCanvasScaleAroundDiagram\(scale \* 1\.08\)/.test(chrome), 'plus zooms around the diagram');
  assert.ok(/setCanvasScaleAroundDiagram\(scale \/ 1\.08\)/.test(chrome), 'minus zooms around the diagram');
  assert.ok(/setCanvasScaleAroundDiagram\(scale \* factor\)/.test(chrome), 'wheel zooms around the diagram');
  assert.ok(/\$\('#btnZoomReset'\)\.onclick = \(\) => \{ centerView\(\)/.test(chrome), 'percent still fits');
}

console.log('ok canvas-view');
