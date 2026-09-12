'use strict';

const assert = require('assert');
const World = require('../../../../packages/board/engine/board-route/world');
global.BoardRouteWorld = World;
const Straight = require('../../../../packages/board/engine/board-route/straight');
const Route = require('../../../../packages/board/engine/board-route');

function box(id, left, top, right, bottom, extra) {
  const width = right - left;
  const height = bottom - top;
  return Object.assign({
    id,
    left,
    right,
    top,
    bottom,
    x: left + width / 2,
    y: top + height / 2,
    width,
    height,
  }, extra || {});
}

const A = box('A', 0, 0, 80, 60);
const B = box('B', 0, 120, 80, 180);
const C = box('C', 200, 80, 280, 140);

{
  const found = Straight.clip(A, B);
  assert.ok(found, 'stacked boxes clip');
  assert.ok(World.samePoint(found.from, World.point(40, 60)), 'leave A bottom center');
  assert.ok(World.samePoint(found.to, World.point(40, 120)), 'enter B top center');
  assert.strictEqual(found.fromSide, 'bottom');
  assert.strictEqual(found.toSide, 'top');
  assert.strictEqual(World.routePath([found.from, found.to]), 'M 40 60 V 120');
}

{
  const found = Straight.clip(A, C);
  assert.ok(found, 'offset boxes clip');
  assert.strictEqual(found.from.x > A.left && found.from.x < A.right || found.from.x === A.right || found.from.y === A.bottom, true);
  assert.ok(
    Math.abs(found.from.x - A.left) < 0.02
    || Math.abs(found.from.x - A.right) < 0.02
    || Math.abs(found.from.y - A.top) < 0.02
    || Math.abs(found.from.y - A.bottom) < 0.02,
    'from sits on A border',
  );
  assert.ok(
    Math.abs(found.to.x - C.left) < 0.02
    || Math.abs(found.to.x - C.right) < 0.02
    || Math.abs(found.to.y - C.top) < 0.02
    || Math.abs(found.to.y - C.bottom) < 0.02,
    'to sits on C border',
  );
  const d = World.routePath([found.from, found.to]);
  assert.ok(/ L /.test(d), 'diagonal uses L: ' + d);
}

{
  assert.strictEqual(Straight.clip(A, A), null, 'same center does not draw');
}

{
  const diamond = box('D', 0, 0, 80, 80, { kind: 'diamond' });
  const other = box('E', 160, 0, 240, 80);
  const found = Straight.clip(diamond, other);
  assert.ok(found, 'diamond clips');
  assert.ok(World.samePoint(found.from, World.point(80, 40)), 'leave diamond right vertex ' + JSON.stringify(found.from));
}

{
  const item = {
    from: 'A',
    to: 'C',
    fromRect: A,
    toRect: C,
    linkIndex: 0,
  };
  const [out] = Route.route({ links: [item], style: 'straight', boxRects: new Map() });
  assert.strictEqual(out.points.length, 2, 'straight is one segment');
  assert.ok(/ L /.test(out.d), 'routed path is a line: ' + out.d);
  assert.ok(!out.selectedRoute, 'does not run orthogonal pack');
}

{
  const mid = World.routeLabel([World.point(0, 0), World.point(100, 40)]);
  assert.strictEqual(mid.x, 50);
  assert.strictEqual(mid.y, 12);
}

console.log('ok straight-route');
