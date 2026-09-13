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
function b64(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

{
  const board = Render.parse(src(`
board Demo
item HERO type text "Hi"
`));
  assert.deepStrictEqual(Render.resolveStyle(board), {
    theme: 'default',
    item_cap: 16,
    link_route: 'stagger',
    type_step: 0,
  });
  assert.ok(!/^style /m.test(Render.serialize(board)), Render.serialize(board));
}

{
  const payload = b64({ theme: 'kami', item_cap: 24, link_route: 'stagger' });
  const board = Render.parse(src(`
board Demo
style ${payload}
item HERO type text "Hi"
`));
  assert.deepStrictEqual(Render.resolveStyle(board), {
    theme: 'kami',
    item_cap: 24,
    link_route: 'stagger',
    type_step: 0,
  });
  const out = Render.serialize(board);
  assert.ok(out.startsWith('board "Demo"\nstyle '), out);
  const token = out.split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    theme: 'kami',
    item_cap: 24,
  });
}

{
  const board = Render.parse(src(`
board Demo
style not-valid-base64!!!
item HERO type text "Hi"
`));
  assert.deepStrictEqual(Render.resolveStyle(board), {
    theme: 'default',
    item_cap: 16,
    link_route: 'stagger',
    type_step: 0,
  });
}

{
  const payload = b64({ theme: 'kami', extra: 'keep' });
  const board = Render.parse(`board Demo\nstyle ${payload}\nitem HERO type text "Hi"\n`);
  const out = Render.serialize(board);
  const token = out.split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    theme: 'kami',
    extra: 'keep',
  });
}

{
  const source = src(`
board Demo
item HERO type text "Hi"
`);
  const next = Render.updateStyle(source, { theme: 'pastel', item_cap: 20, link_route: 'stagger' });
  assert.ok(/^style /m.test(next), next);
  const back = Render.updateStyle(next, { theme: 'default', item_cap: 16, link_route: 'stagger' });
  assert.ok(!/^style /m.test(back), back);
}

{
  const source = src(`
board Demo
item HERO type text "Hi"
`);
  const next = Render.updateStyle(source, { link_route: 'straight' });
  assert.ok(/^style /m.test(next), next);
  const token = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    link_route: 'straight',
  });
  const board = Render.parse(next);
  assert.strictEqual(Render.resolveStyle(board).link_route, 'straight');
  assert.strictEqual(Render.setLinkRouteStyle('nope'), 'stagger');
  const reset = Render.updateStyle(next, { link_route: 'stagger' });
  assert.ok(!/^style /m.test(reset), reset);
}

{
  const source = src(`
board Demo
item HERO type text "Hi"
`);
  const next = Render.updateStyle(source, { type_step: 2 });
  assert.ok(/^style /m.test(next), next);
  const token = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    type_step: 2,
  });
  assert.strictEqual(Render.resolveStyle(Render.parse(next)).type_step, 2);
  const back = Render.updateStyle(next, { type_step: 0 });
  assert.ok(!/^style /m.test(back), back);
  assert.strictEqual(Render.resolveStyle(Render.parse(source + '\n')).type_step, 0);
}

{
  assert.deepStrictEqual(Render.authoredViewport({ scale: 1.25, x: 40.4, y: -12.2 }), {
    scale: 1.25,
    x: 40,
    y: -12,
  });
  assert.deepStrictEqual(Render.authoredViewport({ scale: 9, x: 1, y: 2 }), { scale: 3, x: 1, y: 2 });
  assert.strictEqual(Render.authoredViewport({ scale: 1, x: 1 }), null);
  assert.strictEqual(Render.authoredViewport([1, 2, 3]), null);
}

{
  const payload = b64({ theme: 'kami', viewport: { scale: 1.2, x: 40.6, y: 80 } });
  const board = Render.parse(src(`
board Demo
style ${payload}
item HERO type text "Hi"
`));
  assert.deepStrictEqual(Render.resolveStyle(board), {
    theme: 'kami',
    item_cap: 16,
    link_route: 'stagger',
    type_step: 0,
  });
  const token = Render.serialize(board).split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    theme: 'kami',
    viewport: { scale: 1.2, x: 41, y: 80 },
  });
}

{
  const legacy = b64({ view: { scale: 0.8, x: 12, y: 24 } });
  const board = Render.parse(`board Demo\nstyle ${legacy}\nitem HERO type text "Hi"\n`);
  const token = Render.serialize(board).split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    viewport: { scale: 0.8, x: 12, y: 24 },
  });
}

{
  const source = src(`
board Demo
item HERO type text "Hi"
`);
  const next = Render.updateStyle(source, { viewport: { scale: 0.9, x: 10, y: 20 } });
  const token = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    viewport: { scale: 0.9, x: 10, y: 20 },
  });
  const back = Render.updateStyle(next, { viewport: null, view: null });
  assert.ok(!/^style /m.test(back), back);
}

{
  const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
  const vocab = fs.readFileSync(path.join(__dirname, '../../../skill/board/references/vocab.md'), 'utf8');
  assert.ok(/id="boardCapEditor"/.test(html), 'props have Width Cap select');
  assert.ok(/Width Cap/.test(html), 'cap field is labeled Width Cap');
  assert.ok(!/Capped/.test(html) && !/data-cap=/.test(html), 'cap segments removed');
  assert.ok(/id="btnRouteStraight"/.test(html), 'props have Straight route');
  assert.ok(/props-route-seg/.test(html), 'route control is a segmented axis');
  assert.ok(
    /id="btnRouteStraight"[\s\S]*id="btnRouteStagger"[\s\S]*id="btnRouteTrunk"/.test(html),
    'route axis order is Straight Stagger Trunk',
  );
  assert.ok(!/item_cap|link_route|type_step/.test(vocab), 'vocab does not expose style keys');
  assert.ok(/id="boardFontSizeSection"/.test(html), 'style has Font Size');
  assert.ok(/id="boardFontSizeSlider"/.test(html), 'font size is a slider');
  assert.ok(/Font Size/.test(html), 'font size label');
  assert.ok(/style <base64>/.test(vocab), 'vocab names style as base64');
  assert.ok(/do not add, decode, or edit it/.test(vocab), 'vocab forbids editing style');
}

console.log('ok style-base64');
