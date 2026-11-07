import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../..');
const sketch = fs.readFileSync(path.join(root, 'packages/board-app/workspace/src/kinds/sketch.js'), 'utf8');
const canvas = fs.readFileSync(path.join(root, 'packages/board-app/workspace/src/chrome/canvas-view.js'), 'utf8');
const diagram = fs.readFileSync(path.join(root, 'packages/board-app/workspace/src/kinds/diagram.js'), 'utf8');
const protocol = fs.readFileSync(path.join(root, 'packages/sandbox-app/src/protocol.js'), 'utf8');

assert.match(sketch, /picture\.style\.cssText = "position:relative;width:100%;opacity:0;"/, 'the picture is hidden while the runner loads');
assert.match(sketch, /height:800px/, 'the frame keeps a layout box before the runner reports a size');
assert.match(sketch, /if \(!failed && call\("placeDocumentCamera"\) === true\) \{\s*opts\.cameraPlaced = true;\s*picture\.style\.opacity = "1";/, 'the picture shows only after the camera returns true');
assert.match(sketch, /renderMessage\(html, getSessionAppearance\(\)\)/, 'the runner still receives html and appearance only');
assert.doesNotMatch(protocol, /function renderMessage\(html, appearance, viewport/, 'viewport is not a sandbox render field');

const place = canvas.slice(canvas.indexOf('function placeDocumentCamera'), canvas.indexOf('\nwindow.addEventListener'));
assert.ok(place.indexOf('function placeDocumentCamera') === 0, 'sync camera lives on the canvas');
assert.match(place, /var ok = view \? applyCamera\(view\) : false/, 'a saved view is applied by calling applyCamera');
assert.match(place, /return ok === true/, 'the caller sees applyCamera\'s boolean');
assert.doesNotMatch(place, /requestAnimationFrame|setTimeout/, 'this camera does not wait a frame or a timer');
assert.match(canvas, /register\("placeDocumentCamera", placeDocumentCamera\)/, 'Sketch reaches the camera through a hook');

const finish = diagram.slice(diagram.indexOf('function finishCanvasView'), diagram.indexOf('function syncMermaidStyleChrome'));
assert.match(finish, /if \(opts\.cameraPlaced\) \{\s*applyTransform\(\);/, 'a placed sketch camera is not scheduled again');
assert.ok(finish.indexOf('opts.cameraPlaced') < finish.indexOf('applyRestoredDiagramView'), 'the two-frame restore stays behind the sync camera');

console.log('ok sketch first paint');
