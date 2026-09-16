'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

function src(text) {
  return String(text).replace(/^\n/, '');
}

{
  const board = Render.parse(src(`
board Demo
item HERO type text "Welcome"
item BANNER type text cap off "Welcome wide"
item NOTE type note cap on "still default"
`));
  const hero = board.views.find((n) => n.id === 'HERO');
  const banner = board.views.find((n) => n.id === 'BANNER');
  const note = board.views.find((n) => n.id === 'NOTE');
  assert.strictEqual(hero.cap, undefined, 'default cap is omitted');
  assert.strictEqual(banner.cap, 'off');
  assert.strictEqual(note.cap, undefined, 'cap on is omitted');
  const out = Render.serialize(board);
  assert.ok(out.includes('item BANNER type text cap off "Welcome wide"'), out);
  assert.ok(!/item HERO[^\n]*cap /.test(out), out);
  assert.ok(!/item NOTE[^\n]*cap /.test(out), out);
}

{
  const board = Render.parse('board Demo\nitem X shape diamond cap off "Gate"\n');
  assert.strictEqual(board.views[0].shape, 'diamond');
  assert.strictEqual(board.views[0].cap, 'off');
  assert.ok(Render.serialize(board).includes('item X shape diamond cap off "Gate"'));
}


{
  // serialize omits `type chip`; id + cap off must still parse
  const board = Render.parse('board Demo\nitem GW cap off "API Gateway"\n');
  const gw = board.views.find((n) => n.id === 'GW');
  assert.ok(gw, 'GW id recognized');
  assert.strictEqual(gw.type, 'chip');
  assert.strictEqual(gw.cap, 'off');
  assert.strictEqual(gw.text, 'API Gateway');
  assert.ok(Render.serialize(board).includes('item GW cap off "API Gateway"'));
}


{
  let threw = false;
  try { Render.parse('board Demo\nitem type icon cap off 001\n'); }
  catch (err) { threw = /cap is only valid on chip, text, or note/.test(String(err.message)); }
  assert.ok(threw, 'icon+cap rejected');
}

{
  let threw = false;
  try { Render.parse('board Demo\nitem type text cap maybe "no"\n'); }
  catch (err) { threw = /cap must be on or off/.test(String(err.message)); }
  assert.ok(threw, 'bad cap rejected');
}

{
  const source = src(`
board Demo
item HERO type text "Welcome"
`);
  const sel = { kind: 'item', id: 'HERO', boxId: null, index: -1 };
  const off = Render.updateCap(source, sel, 'off');
  assert.ok(off.includes('item HERO type text cap off "Welcome"'), off);
  const on = Render.updateCap(off, sel, 'on');
  assert.ok(!/cap /.test(on), on);
}

{
  const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
  const itemJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/item/board-item.js'), 'utf8');
  const renderJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/engine/board-render.js'), 'utf8');
  assert.ok(/max-width:\s*var\(--board-item-cap/.test(css), 'items use --board-item-cap');
  assert.ok(/\[data-board-cap="off"\] \{\s*max-width:\s*none;\s*width:\s*max-content/.test(css), 'off stretches to content');
  assert.ok(/\[data-board-cap="off"\][\s\S]{0,180}white-space:\s*pre/.test(css), 'off does not wrap');
  assert.ok(/dataset\.boardCap === ['"]off['"]/.test(itemJs) && /max-content/.test(itemJs), 'off frame keeps max-content');
  assert.ok(/id="boardCapEditor"/.test(html) && /Width Cap/.test(html), 'props have Width Cap select');
  assert.ok(/id="boardItemCapSlider"[^>]*min="8"[^>]*max="24"[^>]*value="16"/.test(html), 'cap slider centers 16');
  assert.ok(/dataset\.boardCap = 'off'/.test(itemJs), 'mount marks cap off');
  assert.ok(
    /eachRootItem\(\(item\) => \{[\s\S]*?measureLive[\s\S]*?eachRootItem\(\(item\) => \{[\s\S]*?measureLive/.test(renderJs),
    'root items measure overflow twice'
  );
  const boot = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');
  assert.ok(/raw == null \|\| raw === ''/.test(boot), 'empty localStorage uses default cap');
}

console.log('ok item-cap');
