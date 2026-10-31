import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Render = require('../../../packages/boxes/engine/render.js').default;

function src(text) {
  return String(text).replace(/^\n/, '');
}

{
  const empty = Render.parse(src(`
boxes Demo
item A "x"
`));
  assert.strictEqual(Render.nodeMaxWidth(empty, 'A'), 16);
  const wide = Render.parse(Render.updateStyle(src(`
boxes Demo
item A "x"
`), { max_width: 3 }));
  assert.strictEqual(Render.resolveStyle(wide).max_width, 3);
  assert.strictEqual(Render.nodeMaxWidth(wide, 'A'), 22);
  const slim = Render.parse(Render.updateStyle(src(`
boxes Demo
item A "x"
`), { max_width: -3 }));
  assert.strictEqual(Render.nodeMaxWidth(slim, 'A'), 10);
}

{
  const board = Render.parse(src(`
boxes Demo
item HERO type text "Welcome"
item BANNER type text cap off "Welcome wide"
item NOTE type note cap on "still default"
`));
  const hero = board.views.find((n) => n.id === 'HERO');
  const banner = board.views.find((n) => n.id === 'BANNER');
  const note = board.views.find((n) => n.id === 'NOTE');
  assert.strictEqual(hero.cap, undefined, 'legacy cap is ignored');
  assert.strictEqual(banner.cap, undefined, 'cap off is ignored');
  assert.strictEqual(note.cap, undefined, 'cap on is ignored');
  const out = Render.serialize(board);
  assert.ok(!/cap /.test(out), out);
  assert.ok(out.includes('item BANNER type text "Welcome wide"'), out);
}

{
  const board = Render.parse('boxes Demo\nitem X shape diamond cap off "Gate"\n');
  assert.strictEqual(board.views[0].shape, 'diamond');
  assert.strictEqual(board.views[0].cap, undefined);
  assert.ok(Render.serialize(board).includes('item X shape diamond "Gate"'));
}

{
  const board = Render.parse('boxes Demo\nitem GW cap off "API Gateway"\n');
  const gw = board.views.find((n) => n.id === 'GW');
  assert.ok(gw, 'GW id recognized');
  assert.strictEqual(gw.type, 'chip');
  assert.strictEqual(gw.text, 'API Gateway');
  assert.ok(Render.serialize(board).includes('item GW "API Gateway"'));
}

{
  const board = Render.parse('boxes Demo\nitem type icon cap off 008\n');
  assert.strictEqual(board.views[0].type, 'icon');
  assert.strictEqual(board.views[0].icon, 8);
}

{
  const board = Render.parse('boxes Demo\nitem type text cap maybe "no"\n');
  assert.strictEqual(board.views[0].type, 'text');
  assert.strictEqual(board.views[0].text, 'no');
}

{
  const source = src(`
boxes Demo
item HERO type text "Welcome"
`);
  const sel = { kind: 'item', id: 'HERO', boxId: null, index: -1 };
  const wide = Render.updateNodeMaxWidth(source, sel, 20);
  const token = wide.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    ids: { HERO: { max_width: 20 } },
  });
  const board = Render.parse(wide);
  assert.strictEqual(Render.authoredNodeMaxWidth(board, 'HERO'), 20);
  assert.strictEqual(Render.nodeMaxWidth(board, 'HERO'), 20);
  assert.strictEqual(Render.nodeMaxWidth(board, 'MISS'), 16);
  const same = Render.updateNodeMaxWidth(wide, sel, 16);
  assert.ok(!/^style /m.test(same), same);
  const reset = Render.updateNodeMaxWidth(wide, sel, null);
  assert.ok(!/^style /m.test(reset), reset);
}

{
  const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
  const itemJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/item/item.js'), 'utf8');
  const renderJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/engine/render.js'), 'utf8');
  assert.ok(/max-width:\s*var\(--board-item-cap/.test(css), 'items use --board-item-cap');
  assert.ok(!/data-board-cap/.test(css), 'cap-off CSS removed');
  assert.ok(!/dataset\.boardCap/.test(itemJs), 'item mount does not mark cap');
  assert.ok(/id="board-max-width-input"/.test(html) && /Max Width/.test(html), 'props have Max Width input');
  assert.ok(/id="board-max-width-slider"[^>]*min="-3"[^>]*max="3"[^>]*value="0"/.test(html), 'width slider is a stage');
  assert.ok(/id="board-max-width-reset"/.test(html), 'props have Reset');
  assert.ok(
    /eachRootItem\(\(item\) => \{[\s\S]*?measureLive[\s\S]*?eachRootItem\(\(item\) => \{[\s\S]*?measureLive/.test(renderJs),
    'root items measure overflow twice'
  );
  const boot = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/src/chrome/chrome-boot.js'), 'utf8');
  assert.ok(/raw == null \|\| raw === ''/.test(boot), 'empty localStorage uses default width');
}

console.log('ok item-cap');
