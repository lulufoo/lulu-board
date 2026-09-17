'use strict';
// World layer: nodes carry world coordinates (negative allowed), the canvas is
// a zero-size anchor, edges paint in world px without a clipping viewBox.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.join(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(repo, rel), 'utf8');
const render = read('packages/board/engine/board-render.js');
const css = read('packages/drawer-app/css/03-diagram.css');
const board = read('packages/drawer-app/js/02-board.js');
const exportPng = read('packages/drawer-app/js/05-export-png.js');
const View = require(path.join(repo, 'packages/board/view/board-view.js'));
global.BoardView = View;
const Layout = require(path.join(repo, 'packages/board/engine/board-layout.js'));
global.BoardLayout = Layout;
const Render = require(path.join(repo, 'packages/board/engine/board-render.js'));

// Canvas anchor and probe.
assert.match(render, /canvas\.style\.width = '0px'; canvas\.style\.height = '0px'/, 'canvas is a zero-size anchor');
assert.match(render, /canvas\.appendChild\(makeWorldProbe\(doc\)\)/, 'canvas carries the scale probe');
assert.doesNotMatch(render, /canvas\.style\.width = `\$\{result\.width\}px`/, 'layout no longer sizes the canvas');
assert.doesNotMatch(render, /root\.style\.width = `\$\{result\.width\}px`/, 'layout no longer sizes the root');

// Edge SVG: identity user units at the origin, never re-boxed to layout size.
assert.match(render, /edgeSvg\.setAttribute\('viewBox', '0 0 1 1'\)/, 'edge svg has a fixed identity viewBox');
assert.doesNotMatch(render, /svg\.setAttribute\('viewBox', `0 0 \$\{Math\.ceil\(layoutWidth\)\}/, 'drawEdges does not re-box the svg');
assert.match(render, /const worldScale = canvasScale\(canvas\)/, 'drawEdges reads scale from the probe');
assert.match(css, /\.board-render svg\.board-edges \{[^}]*overflow: visible !important/, 'edge svg is not clipped by CSS');
assert.doesNotMatch(css, /\.board-edges \{[^}]*width: 100% !important/, 'edge svg is not forced to canvas size');

// Public helpers.
assert.strictEqual(typeof Render.worldBounds, 'function');
assert.strictEqual(typeof Render.canvasScale, 'function');
assert.strictEqual(typeof Render.worldPointFromClient, 'function');
assert.strictEqual(Render.worldBounds(null), null);

// Camera viewport replaces pan-pixel viewport.
assert.deepStrictEqual(Render.authoredViewport({ scale: 1, cx: -120, cy: -158 }), { scale: 1, cx: -120, cy: -158 });
assert.strictEqual(Render.authoredViewport({ scale: 1, x: 0, y: 0 }), null);

// Pins stay world coordinates: a negative pin solves to a negative frame.
{
  const parsed = Render.parse([
    'board Demo',
    'box A "A"',
    'box B "B"',
    'layout',
    '  pin B.start to parent.start -200',
    '  pin B.top to parent.top -158',
  ].join('\n'));
  const measured = new Map([['A', { w: 100, h: 40 }], ['B', { w: 100, h: 40 }]]);
  const result = Layout.layout(parsed, measured, { width: 1200, gap: 24, padding: 24, adaptive: true });
  const b = result.frames.get('B');
  assert.ok(b && b.x < 0 && b.y < 0, `negative pin keeps a negative frame: ${JSON.stringify(b)}`);
}

// App: pointer mapping and export frame come from the world, not the canvas box.
assert.match(board, /BoardRender\.worldPointFromClient\(canvas, event\.clientX, event\.clientY\)/, 'drag maps pointer through the probe');
assert.doesNotMatch(board, /canvas\.clientWidth \/ rect\.width/, 'drag no longer divides by the canvas box');
assert.match(exportPng, /BoardRender\.worldBounds\(target\)/, 'export frames the world bounds');
assert.match(exportPng, /shift:\s*\{/, 'export shifts negative world space into the frame');

console.log('ok world-camera');
