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
  if (!/^meta\s+/.test(lines[i] || "")) throw new Error("expected meta envelope");
  return lines.slice(i + 1).join("\n");
}
const src = fs.readFileSync(
  path.join(__dirname, '../../../skill/assets/templates/board/onboarding.bmd'),
  'utf8'
);
assert.ok(/^meta\s+/.test(src.trim()), 'onboarding starts with meta');
const board = Render.parse(sourceBody(src));
assert.strictEqual(board.title, 'Lulu Board');
const ids = [];
const walk = (b) => { ids.push(b.id); (b.boxes || []).forEach(walk); };
board.boxes.forEach(walk);
['HERO', 'AI', 'CANVAS', 'YOU', 'PROTO', 'LOGIN', 'HOME'].forEach((id) => assert.ok(ids.includes(id), id));
// Hero, the loop row, and the protocol strip are top-level so a first-time user can drag them.
const topIds = board.views.map((v) => v.id);
['HERO', 'AI', 'CANVAS', 'YOU', 'PROTO'].forEach((id) => assert.ok(topIds.includes(id), id + ' top-level'));
assert.strictEqual(board.boxes.find((b) => b.id === 'HERO').type, 'layout');
['AI', 'CANVAS', 'YOU', 'PROTO'].forEach((id) => assert.strictEqual(board.boxes.find((b) => b.id === id).type, 'container', id + ' container'));
assert.ok(src.includes('Welcome to Lulu Board'), src);
assert.ok(src.includes('One protocol. AI writes it. Lulu-Drawer draws it. You work on the canvas.'), src);
assert.ok(src.includes('/board login flow'), src);
assert.ok(src.includes('drag · edit · link'), src);
assert.ok(src.includes('A compact protocol'), src);
assert.ok(!src.includes('Same text'), src);
// The loop is drawn as relations, not as prose.
const out = Render.serialize(board);
assert.ok(out.includes('AI <-> PROTO title "writes"'), out);
assert.ok(out.includes('CANVAS <-> YOU title "on canvas"'), out);
assert.ok(out.includes('CANVAS <-> PROTO title "in sync"'), out);
assert.ok(out.includes('LOGIN -> HOME title "success"'), out);
// The source snippet appears once and matches the drawn cards.
assert.strictEqual(src.split('`box LOGIN 512 \\"Login\\"`').length, 2, 'one source snippet');
assert.ok(src.includes('`  item \\"Email · Password\\"`'), src);
assert.ok(src.includes('`  item \\"Welcome\\"`'), src);
assert.ok(src.includes('`LOGIN -> HOME title \\"success\\"`'), src);
// No tutorial cells and no layout lesson.
assert.ok(!src.includes('① Write'), src);
assert.ok(!src.includes('③ Edit'), src);
assert.ok(!src.includes('align C3COL'), src);
assert.ok(!src.includes('every version stays in History'), src);
assert.ok(/\btype\s+icon\b/.test(src), 'onboarding uses type icon');
assert.ok(!/\btype\s+img\b/.test(src), 'onboarding has no type img');
assert.ok(!/\btype\s+image\b/.test(src), 'onboarding has no type image');
console.log('ok onboarding-template');
