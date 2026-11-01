import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Layout = require('../../../packages/boxes/engine/layout').default;
const Render = require('../../../packages/boxes/engine/render.js').default;

function src(text) {
  return String(text).replace(/^\n/, '');
}
function b64(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

{
  const board = Render.parse(src(`
boxes Demo
item HERO type text "Hi"
`));
  assert.deepStrictEqual(Render.resolveStyle(board), {
    appearance: 'light',
    max_width: 0,
    link_route: 'stagger',
    font_size: 0,
    viewport: { scale: 1, cx: 0, cy: 0 },
  });
  assert.ok(!/^style /m.test(Render.serialize(board)), Render.serialize(board));
}

{
  const payload = b64({ theme: 'pastel', item_cap: 24, link_route: 'stagger' });
  const board = Render.parse(src(`
boxes Demo
style ${payload}
item HERO type text "Hi"
`));
  assert.deepStrictEqual(Render.resolveStyle(board), {
    appearance: 'light',
    max_width: 0,
    link_route: 'stagger',
    font_size: 0,
    viewport: { scale: 1, cx: 0, cy: 0 },
  });
  const out = Render.serialize(board);
  assert.ok(out.startsWith('boxes "Demo"\nstyle '), out);
  const token = out.split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    item_cap: 24,
  });
}

{
  const board = Render.parse(src(`
boxes Demo
style not-valid-base64!!!
item HERO type text "Hi"
`));
  assert.deepStrictEqual(Render.resolveStyle(board), {
    appearance: 'light',
    max_width: 0,
    link_route: 'stagger',
    font_size: 0,
    viewport: { scale: 1, cx: 0, cy: 0 },
  });
}

{
  const payload = b64({ theme: 'pastel', extra: 'keep' });
  const board = Render.parse(`boxes Demo\nstyle ${payload}\nitem HERO type text "Hi"\n`);
  const out = Render.serialize(board);
  const token = out.split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    extra: 'keep',
  });
}

{
  const source = src(`
boxes Demo
item HERO type text "Hi"
`);
  const next = Render.updateStyle(source, { palette: 'pastel', max_width: 2, link_route: 'stagger' });
  assert.ok(/^style /m.test(next), next);
  const token = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), { max_width: 2 });
  const back = Render.updateStyle(next, { palette: 'default', max_width: 0, link_route: 'stagger' });
  assert.ok(!/^style /m.test(back), back);
}

{
  const source = src(`
boxes Demo
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
boxes Demo
item HERO type text "Hi"
`);
  const next = Render.updateStyle(source, { font_size: 2 });
  assert.ok(/^style /m.test(next), next);
  const token = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    font_size: 2,
  });
  assert.strictEqual(Render.resolveStyle(Render.parse(next)).font_size, 2);
  const back = Render.updateStyle(next, { font_size: 0 });
  assert.ok(!/^style /m.test(back), back);
  assert.strictEqual(Render.resolveStyle(Render.parse(source + '\n')).font_size, 0);
}

{
  assert.deepStrictEqual(Render.authoredViewport({ scale: 1.25, cx: 40.4, cy: -12.2 }), {
    scale: 1.25,
    cx: 40,
    cy: -12,
  });
  assert.deepStrictEqual(Render.authoredViewport({ scale: 9, cx: 1, cy: 2 }), { scale: 3, cx: 1, cy: 2 });
  assert.strictEqual(Render.authoredViewport({ scale: 1, cx: 1 }), null);
  assert.strictEqual(Render.authoredViewport({ scale: 1, x: 40, y: 80 }), null, 'legacy pan-pixel viewport is not a camera');
  assert.strictEqual(Render.authoredViewport([1, 2, 3]), null);
}

{
  const payload = b64({ palette: 'pastel', viewport: { scale: 1.2, cx: 40.6, cy: 80 } });
  const board = Render.parse(src(`
boxes Demo
style ${payload}
item HERO type text "Hi"
`));
  assert.deepStrictEqual(Render.resolveStyle(board), {
    appearance: 'light',
    max_width: 0,
    link_route: 'stagger',
    font_size: 0,
    viewport: { scale: 1.2, cx: 41, cy: 80 },
  });
  const token = Render.serialize(board).split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    viewport: { scale: 1.2, cx: 41, cy: 80 },
  });
}

{
  const legacy = b64({ view: { scale: 0.8, cx: 12, cy: 24 } });
  const board = Render.parse(`boxes Demo\nstyle ${legacy}\nitem HERO type text "Hi"\n`);
  const token = Render.serialize(board).split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    viewport: { scale: 0.8, cx: 12, cy: 24 },
  });
}

{
  // Old pan-pixel viewports drop out of the style line: the app fits once instead.
  const stale = b64({ palette: 'pastel', viewport: { scale: 0.8, x: 12, y: 24 } });
  const board = Render.parse(`boxes Demo\nstyle ${stale}\nitem HERO type text "Hi"\n`);
  assert.ok(!/^style /m.test(Render.serialize(board)), 'dropped palette leaves no style line');
}

{
  const source = src(`
boxes Demo
item HERO type text "Hi"
`);
  const next = Render.updateStyle(source, { viewport: { scale: 0.9, cx: 10, cy: 20 } });
  const token = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    viewport: { scale: 0.9, cx: 10, cy: 20 },
  });
  const back = Render.updateStyle(next, { viewport: null, view: null });
  assert.ok(!/^style /m.test(back), back);
}

{
  const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
  const vocab = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/skill-assets/vocab.md'), 'utf8');
  assert.ok(/id="board-max-width-input"/.test(html), 'props have Max Width input');
  assert.ok(/Max Width/.test(html), 'width field is labeled Max Width');
  assert.ok(!/Width Cap/.test(html) && !/data-cap=/.test(html), 'Width Cap removed');
  assert.ok(/id="btnRouteStraight"/.test(html), 'props have Straight route');
  assert.ok(/props-route-seg/.test(html), 'route control is a segmented axis');
  assert.ok(
    /id="btnRouteStraight"[\s\S]*id="btnRouteStagger"[\s\S]*id="btnRouteTrunk"/.test(html),
    'route axis order is Straight Stagger Trunk',
  );
  assert.ok(!/item_cap|link_route|type_step|font_size|max_width/.test(vocab), 'vocab does not expose style keys');
  assert.ok(/id="boardFontSizeSection"/.test(html), 'style has Font Size');
  assert.ok(/id="boardFontSizeSlider"/.test(html), 'font size is a slider');
  assert.ok(/Font Size/.test(html), 'font size label');
  assert.ok(/id="boardNodeFontSlider"/.test(html), 'props have a node font slider');
  assert.ok(/style <base64>/.test(vocab), 'vocab names style as base64');
  assert.ok(/do not add, decode, or edit it/.test(vocab), 'vocab forbids editing style');
  assert.ok(!/\bfz\b/.test(vocab), 'vocab does not expose fz');
}

{
  const source = src(`
boxes Demo
box HERO "Hi"
  item LEAF "Leaf"
`);
  const next = Render.updateNodeTypeStep(source, 'HERO', 1);
  const token = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    ids: { HERO: { fz: 1 } },
  });
  const board = Render.parse(next);
  assert.strictEqual(Render.authoredNodeTypeStep(board, 'HERO'), 1);
  assert.strictEqual(Render.nodeTypeStep(board, 'HERO'), 1);
  assert.strictEqual(Render.nodeTypeStep(board, 'LEAF'), 0);
  const kept = Render.updateStyle(next, { font_size: 1 });
  const keptToken = kept.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(keptToken, 'base64').toString('utf8')), {
    font_size: 1,
    ids: { HERO: { fz: 1 } },
  });
  const back = Render.updateNodeTypeStep(kept, 'HERO', 1);
  assert.ok(/^style /m.test(back), back);
  const backToken = back.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(backToken, 'base64').toString('utf8')), {
    font_size: 1,
  });
  const onlyNode = Render.updateNodeTypeStep(source, 'LEAF', 2);
  const reset = Render.updateNodeTypeStep(onlyNode, 'LEAF', 0);
  assert.ok(!/^style /m.test(reset), reset);
}

{
  const source = src(`
boxes Demo
box HERO "Hi"
  item NEST "Leaf"
`);
  const pinned = Render.updateNodeTypeStep(source, 'NEST', -1);
  const renamed = Render.updateId(pinned, { kind: 'item', id: 'NEST', boxId: 'HERO', index: 0 }, 'NOTE');
  const token = renamed.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    ids: { NOTE: { fz: -1 } },
  });
  const cleared = Render.updateId(renamed, { kind: 'item', id: 'NOTE', boxId: 'HERO', index: 0 }, '');
  assert.ok(!/^style /m.test(cleared), cleared);
}

{
  const source = src(`
boxes Demo
box HERO "Hi"
  item NEST "Leaf"
`);
  const pinned = Render.updateNodeTypeStep(Render.updateNodeTypeStep(source, 'HERO', 2), 'NEST', 1);
  const dissolved = Render.deleteNode(pinned, { kind: 'box', id: 'HERO' });
  const dissolvedToken = dissolved.source.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(dissolvedToken, 'base64').toString('utf8')), {
    ids: { NEST: { fz: 1 } },
  });
  const tree = Render.deleteNode(pinned, { kind: 'box', id: 'HERO', scope: 'tree' });
  assert.ok(!/^style /m.test(tree.source), tree.source);
}

{
  const source = src(`
boxes Demo
box HERO "Hi"
  item "Leaf"
`);
  const same = Render.updateNodeTypeStep(source, { kind: 'item', boxId: 'HERO', index: 0 }, 0);
  assert.strictEqual(same, source);
  const next = Render.updateNodeTypeStep(source, { kind: 'item', boxId: 'HERO', index: 0 }, 2);
  assert.ok(/item ITEM1 "Leaf"/.test(next), next);
  const token = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    ids: { ITEM1: { fz: 2 } },
  });
  const board = Render.parse(next);
  assert.strictEqual(Render.authoredNodeTypeStep(board, 'ITEM1'), 2);
}

{
  const source = src(`
boxes Demo
item HERO type text "Hi"
`);
  const next = Render.updateStyle(source, { background: 'dusk' });
  assert.ok(!/^style /m.test(next), next);
  const themed = Render.updateStyle(source, { palette: 'classic' });
  assert.ok(!/^style /m.test(themed), themed);
  const dead = Render.updateStyle(themed, { theme: 'pastel', color: 'classic', background: 'dusk' });
  assert.ok(!/^style /m.test(dead), dead);
}

{
  const payload = b64({ palette: 'pastel', type_step: 3 });
  const board = Render.parse(`boxes Demo\nstyle ${payload}\nitem HERO type text "Hi"\n`);
  assert.strictEqual(Render.resolveStyle(board).font_size, 0);
  const token = Render.serialize(board).split('\n')[1].replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(token, 'base64').toString('utf8')), {
    type_step: 3,
  });
  const next = Render.updateStyle(Render.serialize(board), { font_size: 2 });
  const nextToken = next.split('\n').find((line) => /^style /.test(line)).replace(/^style\s+/, '').trim();
  assert.deepStrictEqual(JSON.parse(Buffer.from(nextToken, 'base64').toString('utf8')), {
    font_size: 2,
    type_step: 3,
  });
}

{
  const Token = require('../../../packages/board-core/style-token.js');
  const obj = { palette: 'classic', font_size: 2 };
  assert.strictEqual(Render.encodeStylePayload(obj), Token.encodeStylePayload(obj), 'Board uses the shared token encode');
  assert.deepStrictEqual(Render.decodeStylePayload(Token.encodeStylePayload(obj)), obj);
}

console.log('ok style-base64');
