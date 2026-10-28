import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const assert = require('assert');
const Ground = require('../../packages/drawer-app/src/core/workspace-ground.js').default;

{
  const spec = Ground.resolveGround();
  assert.deepStrictEqual(spec, { background: '#fff', dot: '#dfe7ea', dotRadius: 1, step: 24 });
  assert.deepStrictEqual(Ground.resolveGround('paper'), spec);
  spec.step = 99;
  assert.strictEqual(Ground.resolveGround().step, 24, 'resolveGround hands out a copy');
}

{
  assert.deepStrictEqual(Ground.resolveGround('dusk'), {
    background: '#bbc7dc',
    dot: '#9facc1',
    dotRadius: 1,
    step: 24,
  });
  assert.deepStrictEqual(Ground.resolveGround('nope'), Ground.resolveGround('paper'));
  assert.deepStrictEqual(Ground.listGrounds().map((ground) => ground.id), ['paper', 'mist', 'sage', 'dusk']);
}

{
  const set = {};
  Ground.applyGround({ style: { setProperty: (name, value) => { set[name] = value; } } });
  assert.deepStrictEqual(Object.keys(set).sort(), ['--ground-bg', '--ground-image', '--ground-size']);
  assert.strictEqual(set['--ground-bg'], '#fff');
  assert.strictEqual(set['--ground-size'], '24px 24px');
  const image = set['--ground-image'];
  assert.match(image, /^url\("data:image\/svg\+xml;utf8,<svg /);
  assert.match(image, /width='24' height='24'/);
  assert.match(image, /<circle cx='12' cy='12' r='1' fill='%23dfe7ea'\/>/);
  assert.doesNotMatch(image, /#/, 'a raw # would cut the data URI');
}

{
  const calls = [];
  const arcs = [];
  const ctx = {
    set fillStyle(value) { calls.push(['fillStyle', value]); },
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: () => {},
    arc: (...args) => arcs.push(args),
    fill: () => calls.push(['fill']),
  };
  // 2x export: 240 x 120 css px painted on a 480 x 240 canvas.
  Ground.paintGround(ctx, { width: 480, height: 240 }, { width: 240, height: 120 });

  assert.deepStrictEqual(calls.slice(0, 3), [['fillStyle', '#fff'], ['fillRect', 0, 0, 480, 240], ['fillStyle', '#dfe7ea']]);
  assert.strictEqual(calls.filter((call) => call[0] === 'fill').length, 1, 'all dots are filled in one pass');
  assert.strictEqual(arcs.length, 10 * 5, 'one dot per 24 css px cell');
  assert.deepStrictEqual(arcs[0], [24, 24, 2, 0, Math.PI * 2], 'first dot sits at the cell center, radius scales with the ratio');
  assert.ok(arcs.every(([x, y, radius]) => (x - 24) % 48 === 0 && (y - 24) % 48 === 0 && radius === 2), 'dots follow the 48 px step');
}

console.log('ok workspace-ground');
