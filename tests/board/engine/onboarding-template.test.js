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
  path.join(__dirname, '../../../skill/assets/templates/board/onboarding.bmd'),
  'utf8'
);
assert.ok(/^meta\s+\{/.test(src.trim()), 'onboarding starts with meta');
const board = Render.parse(sourceBody(src));
assert.strictEqual(board.title, 'Lulu Board');
const ids = [];
const walk = (b) => { ids.push(b.id); (b.boxes || []).forEach(walk); };
board.boxes.forEach(walk);
['HERO', 'C1', 'C2', 'C3', 'C4', 'LOGIN', 'HOME'].forEach((id) => assert.ok(ids.includes(id), id));
// Title block and the four cells are top-level so a first-time user can drag them.
const topIds = board.views.map((v) => v.id);
['HERO', 'C1', 'C2', 'C3', 'C4'].forEach((id) => assert.ok(topIds.includes(id), id + ' top-level'));
assert.strictEqual(board.boxes.find((b) => b.id === 'HERO').type, 'layout');
assert.ok(src.includes('Welcome to Lulu Board'), src);
assert.ok(src.includes('One text. One canvas. You and AI.'), src);
['C1', 'C2', 'C3', 'C4'].forEach((id) => assert.strictEqual(board.boxes.find((b) => b.id === id).type, 'container', id + ' container'));
const out = Render.serialize(board);
assert.ok(out.includes('LOGIN -> HOME title "success"'), out);
assert.ok(out.includes('LOGIN2 -> HOME2'), out);
assert.ok(out.includes('\\"Login\\"'), out);
assert.ok(src.includes('`align C3COL stretch`'), src);
assert.ok(src.includes('③ Edit'), src);
assert.ok(out.includes('align C3COL stretch'), out);
assert.ok(src.includes('Align is a layout line in the source.'), src);
assert.ok(!src.includes('arrange HOME below LOGIN'), src);
assert.ok(!src.includes('Drag a card'), src);
assert.ok(out.includes('justify C2ROW, C2, C3COL stretch'), out);
assert.ok(out.includes('flush C1, C2 top'), out);
assert.ok(out.includes('flush C1, C2 bottom'), out);
assert.ok(out.includes('flush C3, C4 top'), out);
assert.ok(out.includes('flush C3, C4 bottom'), out);
assert.ok(!out.includes('align C1, C2 top'), out);
assert.ok(!out.includes('barrier'), out);
assert.ok(/\btype\s+icon\b/.test(src), 'onboarding uses type icon');
assert.ok(!/\btype\s+img\b/.test(src), 'onboarding has no type img');
assert.ok(!/\btype\s+image\b/.test(src), 'onboarding has no type image');
assert.ok(out.includes('type icon 515'), out);
console.log('ok onboarding-template');
