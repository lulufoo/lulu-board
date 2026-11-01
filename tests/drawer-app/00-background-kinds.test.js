import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const assert = require('assert');
const Token = require('../../packages/board-core/style-token.js');
const Style = require('../../packages/drawer-app/src/core/style-line.js').default;
const Ground = require('../../packages/drawer-app/src/core/workspace-ground.js').default;
const Render = require('../../packages/boxes/engine/render.js').default;

function decodeToken(body) {
  return Token.decodeStylePayload(Style.splitRendererStyle(body).token);
}

function persistKind(body, patch) {
  const styled = Style.splitRendererStyle(body);
  return Style.joinRendererStyle(Style.persistStyleToken(styled.token, patch), styled.body);
}

{
  const boxes = Render.updateStyle('boxes "Demo"\nitem HERO type text "Hi"\n', { background: 'dusk' });
  assert.ok(!/^style /m.test(boxes), boxes);
  const boxesNext = Render.updateStyle(boxes, { palette: 'classic' });
  assert.deepStrictEqual(decodeToken(boxesNext), { palette: 'classic' });
}

{
  const sketch = persistKind('sketch ""\ncontent e30=\n', { background: 'sage', theme: 'pastel' });
  assert.strictEqual(sketch, 'sketch ""\ncontent e30=\n');
  const sketchNext = persistKind(sketch, { palette: 'pastel' });
  assert.deepStrictEqual(decodeToken(sketchNext), { palette: 'pastel' });
  assert.strictEqual(Style.bodyKind(sketchNext), 'sketch');
}

{
  const flow = persistKind('flowchart TD\nA-->B\n', { background: 'mist', color: 'classic' });
  assert.strictEqual(flow, 'flowchart TD\nA-->B\n');
  const flowNext = persistKind(flow, { palette: 'classic' });
  assert.deepStrictEqual(decodeToken(flowNext), { palette: 'classic' });
  assert.strictEqual(Style.bodyKind(flowNext), 'flowchart');
}

{
  const set = {};
  Ground.applyGround({ style: { setProperty: (name, value) => { set[name] = value; } } }, 'sage');
  assert.strictEqual(set['--ground-bg'], '#fff');
}

console.log('ok background-kinds');
