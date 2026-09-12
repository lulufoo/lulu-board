'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

function sourceBody(text) {
  const lines = String(text).split(/\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (!/^meta\s+\{/.test(lines[i] || "")) throw new Error("expected meta envelope");
  return lines.slice(i + 1).join("\n");
}
const src = fs.readFileSync(
  path.join(__dirname, '../../../skill/board/templates/demo.bmd'),
  'utf8'
);
assert.ok(/^meta\s+\{/.test(src.trim()), 'demo starts with meta');
const board = Render.parse(sourceBody(src));
assert.strictEqual(board.title, 'Demo');
assert.ok(board.boxes.some((b) => b.id === 'IN'));
assert.ok(board.boxes.some((b) => b.id === 'WORK' && String(b.type || b.kind) === 'container'));
const out = Render.serialize(board);
assert.ok(out.includes('item GATE shape diamond'), out);
assert.ok(out.includes('IN <-> OUT'), out);
assert.ok(out.includes('flush IN, OUT top'), out);
assert.ok(!out.includes('align IN, OUT top'), out);
assert.ok(!out.includes('justify'), out);
assert.ok(!out.includes('barrier'), out);
assert.ok(/\btype\s+icon\b/.test(src), 'demo uses type icon');
assert.ok(!/\btype\s+img\b/.test(src), 'demo has no type img');
assert.ok(out.includes('item Flag type icon 502'), out);
console.log('ok demo-template');
