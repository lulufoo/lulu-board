'use strict';
const assert = require('assert');
const World = require('../../../../packages/board/engine/board-route/world');

// a straight run is untouched
assert.strictEqual(World.routePath([{ x: 0, y: 0 }, { x: 0, y: 50 }]), 'M 0 0 V 50');

// an L bend is rounded with an 8px quadratic arc; the last segment keeps a straight run
assert.strictEqual(
  World.routePath([{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 60, y: 40 }]),
  'M 0 0 V 32 Q 0 40 8 40 H 60',
);

// the radius shrinks to half of a short segment instead of overshooting
assert.strictEqual(
  World.routePath([{ x: 0, y: 0 }, { x: 0, y: 6 }, { x: 60, y: 6 }]),
  'M 0 0 V 3 Q 0 6 3 6 H 60',
);

// a Z route gets two arcs
const z = World.routePath([{ x: 0, y: 0 }, { x: 0, y: 30 }, { x: 50, y: 30 }, { x: 50, y: 80 }]);
assert.strictEqual((z.match(/Q/g) || []).length, 2);
assert.ok(z.endsWith('V 80'));
console.log('ok corner-radius');
