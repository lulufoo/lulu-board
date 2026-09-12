'use strict';

const World = require('../../../../packages/board/engine/board-route/world');
const Choose = require('../../../../packages/board/engine/board-route/choose');
const Plan = require('../../../../packages/board/engine/board-route/plan');
const Compose = require('../../../../packages/board/engine/board-route/compose');
const Route = require('../../../../packages/board/engine/board-route');

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function samePoly(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((pt, index) => World.samePoint(pt, b[index]));
}

function trunkTail(points, junction) {
  const idx = points.findIndex((pt) => World.samePoint(pt, junction));
  assert(idx >= 0, 'composed path includes junction');
  return points.slice(idx);
}

const A = { id: 'A', left: 0, right: 80, top: 0, bottom: 60 };
const B = { id: 'B', left: 0, right: 80, top: 100, bottom: 160 };
const C = { id: 'C', left: 0, right: 80, top: 200, bottom: 260 };
const T = { id: 'T', left: 320, right: 400, top: 100, bottom: 160 };
const boxRects = new Map([['A', A], ['B', B], ['C', C], ['T', T]]);
const parentOf = new Map([['A', null], ['B', null], ['C', null], ['T', null]]);
const ownerOf = new Map();

function makeLinks(order) {
  const specs = {
    A: { from: 'A', to: 'T', fromRect: { ...A, x: 40, y: 30, width: 80, height: 60 }, toRect: { ...T, x: 360, y: 130, width: 80, height: 60 } },
    B: { from: 'B', to: 'T', fromRect: { ...B, x: 40, y: 130, width: 80, height: 60 }, toRect: { ...T, x: 360, y: 130, width: 80, height: 60 } },
    C: { from: 'C', to: 'T', fromRect: { ...C, x: 40, y: 230, width: 80, height: 60 }, toRect: { ...T, x: 360, y: 130, width: 80, height: 60 } },
  };
  return order.map((id, linkIndex) => ({ ...specs[id], linkIndex }));
}

// --- grouping ---
{
  const links = makeLinks(['A', 'B', 'C']);
  const { groups, fallback } = Plan.groupLinks(links, 'trunk');
  assert(groups.length === 1, '3 fan-in links form one group');
  assert(groups[0].kind === 'fan-in', 'group is fan-in');
  assert(groups[0].hub === 'T', 'hub is T');
  assert(groups[0].links.length === 3, 'group has 3 links');
  assert(fallback.length === 0, 'no leftover when all grouped');
  assert(Plan.groupLinks(links, 'stagger').groups.length === 0, 'stagger does not group');
  assert(Plan.groupLinks(makeLinks(['A', 'B']), 'trunk').groups.length === 0, 'N<3 does not group');
}

// --- free-point draw ---
{
  const j = World.point(200, 130);
  const pack = Choose.packFor({
    from: 'A',
    to: null,
    fromRect: { ...A, x: 40, y: 30, width: 80, height: 60 },
    toFree: { point: j, dirs: World.ROUTE_SIDES },
  }, boxRects, parentOf, ownerOf);
  assert(pack && pack.batch && pack.batch.length, 'leaf→J packFor finds paths');
  const picked = Choose.pickCandidate(pack.batch, [], 'trunk', A, { left: 199, right: 201, top: 129, bottom: 131 }, pack.obstacles);
  assert(picked && World.samePoint(picked.points[picked.points.length - 1], j), 'leaf→J ends at free point');
}

// --- plan shared trunk + order independence ---
{
  const forward = makeLinks(['A', 'B', 'C']);
  const reverse = makeLinks(['C', 'B', 'A']);
  const planA = Plan.planTrunk(forward, 'trunk', boxRects, parentOf, ownerOf);
  const planB = Plan.planTrunk(reverse, 'trunk', boxRects, parentOf, ownerOf);
  assert(planA.groups.length === 1, 'plan finds a junction group');
  assert(planB.groups.length === 1, 'reversed order still plans');
  const trunkA = planA.groups[0].trunk.points;
  const trunkB = planB.groups[0].trunk.points;
  assert(samePoly(trunkA, trunkB), 'shared trunk geometry is order-independent');
  const j = planA.groups[0].junction.point;
  planA.groups[0].branches.forEach((entry) => {
    const merged = Compose.mergeSegments('fan-in', entry.drawn, planA.groups[0].trunk);
    assert(merged, 'compose merges branch+trunk');
    assert(samePoly(trunkTail(merged.points, j), trunkA), 'each link reuses the same trunk tail');
  });
  assert(planA.groups[0].branches.length === 3, 'three branches');
}

// --- full route() keeps N links and shared trunk ---
{
  const links = makeLinks(['A', 'B', 'C']);
  Route.route({ links, boxRects, views: [], style: 'trunk' });
  assert(links.length === 3, 'DSL still has N links');
  assert(links.every((item) => item.points && item.points.length >= 2), 'all links got points');
  assert(links.every((item) => item.d), 'all links got d');
  function suffixKey(points, fromIndex) {
    return points.slice(fromIndex).map((pt) => World.pointKey(pt)).join('|');
  }
  let shared = null;
  for (let start = 0; start < links[0].points.length - 1; start += 1) {
    const key = suffixKey(links[0].points, start);
    const span = links[0].points.length - start;
    if (links.every((item) => item.points.length >= span && suffixKey(item.points, item.points.length - span) === key)) {
      const len = World.pathLength(links[0].points.slice(start));
      if (len + World.ROUTE_EPSILON >= 2 * World.ROUTE_GAP) {
        shared = len;
        break;
      }
    }
  }
  assert(shared != null, 'routed fan-in shares a trunk suffix');
}

// --- fallback when J impossible (hub boxed in by walls) ---
{
  const hub = { id: 'H', left: 300, right: 360, top: 100, bottom: 160 };
  const wallL = { id: 'WL', left: 200, right: 280, top: 0, bottom: 400 };
  const wallR = { id: 'WR', left: 380, right: 460, top: 0, bottom: 400 };
  const wallT = { id: 'WT', left: 200, right: 460, top: 0, bottom: 80 };
  const wallB = { id: 'WB', left: 200, right: 460, top: 180, bottom: 400 };
  const L1 = { id: 'L1', left: 0, right: 60, top: 0, bottom: 40 };
  const L2 = { id: 'L2', left: 0, right: 60, top: 80, bottom: 120 };
  const L3 = { id: 'L3', left: 0, right: 60, top: 160, bottom: 200 };
  const rects = new Map([['H', hub], ['WL', wallL], ['WR', wallR], ['WT', wallT], ['WB', wallB], ['L1', L1], ['L2', L2], ['L3', L3]]);
  const parents = new Map([...rects.keys()].map((id) => [id, null]));
  const blocked = [
    { from: 'L1', to: 'H', fromRect: { ...L1, x: 30, y: 20, width: 60, height: 40 }, toRect: { ...hub, x: 330, y: 130, width: 60, height: 60 }, linkIndex: 0 },
    { from: 'L2', to: 'H', fromRect: { ...L2, x: 30, y: 100, width: 60, height: 40 }, toRect: { ...hub, x: 330, y: 130, width: 60, height: 60 }, linkIndex: 1 },
    { from: 'L3', to: 'H', fromRect: { ...L3, x: 30, y: 180, width: 60, height: 40 }, toRect: { ...hub, x: 330, y: 130, width: 60, height: 60 }, linkIndex: 2 },
  ];
  const planned = Plan.planTrunk(blocked, 'trunk', rects, parents, new Map());
  assert(planned.groups.length === 0, 'impossible J falls back (no planned group)');
  assert(planned.fallback.length === 3, 'all three links are fallback');
}

// --- compose stitch dedupes junction ---
{
  const branch = { points: [World.point(0, 0), World.point(10, 0), World.point(10, 5)], source: { side: 'right' }, target: { side: 'left' } };
  const trunk = { points: [World.point(10, 5), World.point(30, 5)], source: { side: 'right' }, target: { side: 'left' } };
  const merged = Compose.mergeSegments('fan-in', branch, trunk);
  assert(merged.points.length === 4, 'compose drops duplicate junction');
  assert(merged.fromSide === 'right' && merged.toSide === 'left', 'compose keeps leaf/hub sides');
}

// --- trunk rank no longer rewards overlap ---
{
  const Rank = require('../../../../packages/board/engine/board-route/rank');
  const occupied = [{ from: World.point(0, 0), to: World.point(100, 0) }];
  const candidate = { points: [World.point(0, 0), World.point(80, 0)], source: { side: 'right' }, target: { side: 'left' }, length: 80, folds: 1 };
  const row = Rank.scoreRow(candidate, 0, { occupied, fromRect: A, toRect: T, obstacles: [] }, Rank.table('trunk'));
  assert(row.bundle === 0, 'trunk bundle score is neutral (no overlap merge)');
}

console.log('ok plan');
