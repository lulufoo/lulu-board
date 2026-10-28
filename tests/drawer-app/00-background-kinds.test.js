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
  const boxesNext = Render.updateStyle(boxes, { theme: 'classic' });
  assert.deepStrictEqual(decodeToken(boxesNext), { theme: 'classic', background: 'dusk' });
  assert.strictEqual(Style.fieldsFromStyleToken(Style.splitRendererStyle(boxesNext).token).background, 'dusk');
}

{
  const sketch = persistKind('sketch ""\ncontent e30=\n', { background: 'sage' });
  assert.match(sketch, /^style /);
  const sketchNext = persistKind(sketch, { theme: 'pastel' });
  assert.deepStrictEqual(decodeToken(sketchNext), { theme: 'pastel', background: 'sage' });
  assert.strictEqual(Style.bodyKind(sketchNext), 'sketch');
  assert.strictEqual(Style.fieldsFromStyleToken(Style.splitRendererStyle(sketchNext).token).background, 'sage');
}

{
  const flow = persistKind('flowchart TD\nA-->B\n', { background: 'mist' });
  assert.match(flow, /^%% style /);
  const flowNext = persistKind(flow, { theme: 'classic' });
  assert.deepStrictEqual(decodeToken(flowNext), { theme: 'classic', background: 'mist' });
  assert.strictEqual(Style.bodyKind(flowNext), 'flowchart');
  assert.strictEqual(Style.fieldsFromStyleToken(Style.splitRendererStyle(flowNext).token).background, 'mist');
}

{
  const set = {};
  Ground.applyGround({ style: { setProperty: (name, value) => { set[name] = value; } } }, 'sage');
  assert.strictEqual(set['--ground-bg'], '#b4ccc3');
  Ground.applyGround({ style: { setProperty: (name, value) => { set[name] = value; } } }, 'paper');
  assert.strictEqual(set['--ground-bg'], '#fff');
}

console.log('ok background-kinds');
