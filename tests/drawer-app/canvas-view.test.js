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
assert.ok(/persistDocumentView/.test(canvas), 'writes viewport into document style');
assert.ok(/forgetDocumentView/.test(canvas), 'Fit clears document viewport');
assert.ok(!/id="boardView/.test(html), 'Style panel does not expose viewport');
assert.ok(!/view_scale|view_pan/.test(canvas), 'does not split viewport into three style keys');

console.log('ok canvas-view');
