'use strict';

const World = require('../../../../packages/board/engine/board-route/world');
const Choose = require('../../../../packages/board/engine/board-route/choose');

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const APP = { id: 'APP', left: -82, right: 125, top: -95, bottom: 121 };
const PLANE = { id: 'PLANE', left: 268, right: 532, top: 20, bottom: 515 };
const VM = { id: 'VM', left: 746, right: 992, top: 117, bottom: 431 };
const obstacles = [PLANE];

const wantY = World.clampedSideCoord(APP, 'right', VM, obstacles);
assert(Math.abs(wantY - (PLANE.top - World.ROUTE_GAP)) < World.ROUTE_EPSILON, 'APP right clamps to 24 above PLANE');

const farBox = { id: 'FAR', left: 268, right: 532, top: 80, bottom: 200 };
const centerY = (APP.top + APP.bottom) / 2;
const stay = World.clampedSideCoord(APP, 'right', VM, [farBox]);
assert(Math.abs(stay - centerY) < World.ROUTE_EPSILON, 'center already farther than 24 stays');

const shortApp = { id: 'SHORT', left: -82, right: 125, top: 0, bottom: 20 };
const near = { id: 'NEAR', left: 160, right: 400, top: 15, bottom: 80 };
const capped = World.clampedSideCoord(shortApp, 'right', VM, [near]);
assert(Math.abs(capped - shortApp.top) < World.ROUTE_EPSILON, 'x < 24 caps at box top');

const parentOf = new Map([['APP', null], ['PLANE', null], ['VM', null]]);
const boxRects = new Map([['APP', APP], ['PLANE', PLANE], ['VM', VM]]);
const pack = Choose.packFor(
  { from: 'APP', to: 'VM', fromRect: APP, toRect: VM },
  boxRects,
  parentOf,
  new Map(),
);
assert(pack && pack.k === 2, 'APP→VM stays 2-fold');
const picked = Choose.pickCandidate(pack.batch, [], 'trunk', APP, VM, pack.obstacles);
assert(picked, 'APP→VM picks a candidate');
assert(Math.abs(picked.points[0].y - (PLANE.top - World.ROUTE_GAP)) < 0.6, 'picked H sits 24 above PLANE');
assert(picked.folds === 2, 'pick does not raise k');

const midPts = [{ x: APP.right, y: centerY }, { x: 869, y: centerY }, { x: 869, y: VM.top }];
const gapPts = [{ x: APP.right, y: wantY }, { x: 869, y: wantY }, { x: 869, y: VM.top }];
assert(World.pathBoxClearance(midPts, obstacles) < World.ROUTE_GAP, 'center-height H is closer than 24');
assert(World.pathBoxClearance(gapPts, obstacles) >= World.ROUTE_GAP - World.ROUTE_EPSILON, '24-above H meets the floor');
assert(
  World.geometricCenterBias({ folds: 1, source: { bias: 0 }, target: { bias: 0 } })
    < World.geometricCenterBias({ folds: 1, source: { bias: 17 }, target: { bias: 0 } }),
  'k=1: balanced (0,0) beats one-sided (17,0)',
);
assert(
  World.geometricCenterBias({ folds: 3, source: { bias: 0 }, target: { bias: 0 } })
    < World.geometricCenterBias({ folds: 3, source: { bias: 17 }, target: { bias: 0 } }),
  'k>1: each end still prefers its own mid',
);

const lowApp = { id: 'APP', left: -82, right: 125, top: 80, bottom: 296 };
const highPlane = { id: 'PLANE', left: 268, right: 532, top: 58, bottom: 515 };
const lift = World.clampedCoord(true, 21.5, 869, (lowApp.top + VM.top) / 2, [highPlane], highPlane.top - 48, highPlane.bottom + 48);
assert(Math.abs(lift - (highPlane.top - World.ROUTE_GAP)) < World.ROUTE_EPSILON, 'interior center exits 24 above the box');
const farBelow = { id: 'LOC', left: -111, right: 91, top: 357, bottom: 539 };
const liftFar = World.clampedCoord(true, 15.5, 869, 125.5, [highPlane, farBelow], highPlane.top - 48, 600);
assert(Math.abs(liftFar - (highPlane.top - World.ROUTE_GAP)) < World.ROUTE_EPSILON, 'box below does not hide being inside PLANE');

const lowPack = Choose.packFor(
  { from: 'APP', to: 'VM', fromRect: lowApp, toRect: VM },
  new Map([['APP', lowApp], ['PLANE', highPlane], ['VM', VM]]),
  new Map([['APP', null], ['PLANE', null], ['VM', null]]),
  new Map(),
);
assert(lowPack && lowPack.k === 3, 'APP below PLANE top uses 3-fold');
const lowPicked = Choose.pickCandidate(lowPack.batch, [], 'trunk', lowApp, VM, lowPack.obstacles);
const rail = lowPicked.points.find((pt, index) => index > 0 && index < lowPicked.points.length - 1);
const hY = lowPicked.points[1].y === lowPicked.points[2].y ? lowPicked.points[1].y : rail.y;
assert(Math.abs(hY - (highPlane.top - World.ROUTE_GAP)) < 0.6, 'k=3 rail sits 24 above PLANE');
assert(Math.abs(lowPicked.points[0].x - (lowApp.left + lowApp.right) / 2) < 24, 'first fold stays near APP top center');

const GATE = {
  id: 'GATE',
  kind: 'diamond',
  left: 322,
  right: 478,
  top: 207,
  bottom: 318,
  x: 400,
  y: 262.5,
  width: 156,
  height: 111,
};
const LOC = { id: 'LOC', left: -109, right: 93, top: 354, bottom: 536 };
const BOT = { id: 'BOT', left: 299, right: 501, top: 342, bottom: 524 };
const locApp = { id: 'APP', left: -111, right: 96, top: 83, bottom: 299 };
const locPack = Choose.packFor(
  { from: 'GATE', to: 'LOC', fromRect: GATE, toRect: LOC },
  new Map([['GATE', GATE], ['LOC', LOC], ['BOT', BOT], ['PLANE', highPlane], ['APP', locApp]]),
  new Map([['GATE', 'PLANE'], ['LOC', null], ['BOT', 'PLANE'], ['PLANE', null], ['APP', null]]),
  new Map(),
);
assert(locPack && locPack.batch.length, 'GATE→LOC has walkable paths');
const locPicked = Choose.pickCandidate(locPack.batch, [], 'trunk', GATE, LOC, locPack.obstacles);
const locLast = locPicked.points[locPicked.points.length - 1];
const locMid = (LOC.top + LOC.bottom) / 2;
assert(Math.abs(locLast.y - locMid) < 24, 'arrow fold stays near LOC side center');
assert(Math.abs(locLast.y - LOC.bottom) > 20, 'arrow fold is not on LOC bottom');

console.log('ok center-clamp');
