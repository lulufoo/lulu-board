/* BoxesRoute facade: Plan→Draw→Compose for trunk groups; pairwise otherwise. */
import * as World from './world.js';
import * as Choose from './choose.js';
import * as Arrow from './arrow.js';
import * as Label from './label.js';
import * as Plan from './plan.js';
import * as Compose from './compose.js';
import * as Straight from './straight.js';
import * as Search from './search.js';
import * as Fallback from './fallback.js';
import * as Gates from './gates.js';
import * as Rank from './rank.js';

function rememberRoute(occupied, points) {
  for (let index = 1; index < points.length; index += 1) {
    occupied.push({ from: points[index - 1], to: points[index] });
  }
}

function drawPairwise(item, boxRects, parentOf, ownerOf, occupiedSegments, style) {
  const pack = item.selectedRoute || Choose.packFor(item, boxRects, parentOf, ownerOf);
  item.selectedRoute = pack;
  const batch = pack && pack.batch && pack.batch.length
    ? Arrow.drawableBatch(pack.batch, pack.obstacles)
    : null;
  const selected = batch && batch.length
    ? Choose.pickCandidate(batch, occupiedSegments, style, item.fromRect, item.toRect, pack.obstacles)
    : null;
  if (!selected) return false;
  item.points = Arrow.paintArrowRun(selected.points, pack.obstacles);
  item.d = World.routePath(item.points);
  const label = World.routeLabel(item.points);
  item.labelX = label.x;
  item.labelY = label.y;
  item.fromSide = selected.source.side;
  item.toSide = selected.target.side;
  rememberRoute(occupiedSegments, item.points);
  return true;
}

function drawPlannedGroup(group, occupiedSegments) {
  const trunk = group.trunk;
  if (!trunk || !trunk.points) return false;
  let ok = true;
  group.branches.forEach((entry) => {
    const merged = Compose.mergeSegments(group.kind, entry.drawn, trunk);
    if (!merged) {
      ok = false;
      return;
    }
    const applied = Compose.applyToLink(
      entry.item,
      merged,
      (points, obstacles) => Arrow.paintArrowRun(points, obstacles, { enforceMin: false }),
      group.obstacles || trunk.obstacles,
    );
    if (!applied) {
      ok = false;
      return;
    }
    rememberRoute(occupiedSegments, entry.item.points);
  });
  return ok;
}

export function route(input) {
  const raw = input && input.style;
  const style = raw === 'stagger' || raw === 'straight' ? raw : 'trunk';
  const boxRects = input && input.boxRects instanceof Map ? input.boxRects : new Map();
  const { parentOf, ownerOf } = World.recordTree((input && (input.views || input.boxes)) || []);
  const items = Array.isArray(input && input.links) ? input.links.slice() : [];
  const occupiedSegments = [];

  if (style === 'straight') {
    items.forEach((item) => { Straight.apply(item); });
    return items;
  }

  if (style === 'trunk') {
    const planned = Plan.planTrunk(items, style, boxRects, parentOf, ownerOf);
    const plannedKeys = new Set();
    planned.groups.forEach((group) => {
      if (!drawPlannedGroup(group, occupiedSegments)) {
        group.links.forEach((item) => planned.fallback.push(item));
        return;
      }
      group.links.forEach((item) => plannedKeys.add(Plan.linkKey(item)));
    });
    planned.fallback.forEach((item) => {
      if (plannedKeys.has(Plan.linkKey(item))) return;
      drawPairwise(item, boxRects, parentOf, ownerOf, occupiedSegments, style);
    });
    return items;
  }

  items.forEach((item) => {
    item.selectedRoute = Choose.packFor(item, boxRects, parentOf, ownerOf);
  });
  items.forEach((item) => {
    drawPairwise(item, boxRects, parentOf, ownerOf, occupiedSegments, style);
  });
  return items;
}

export const placeLabel = Label.place;
export const sidePoint = World.sidePoint;

export {
  World,
  Search,
  Fallback,
  Arrow,
  Gates,
  Rank,
  Choose,
  Plan,
  Compose,
  Label,
  Straight,
};
