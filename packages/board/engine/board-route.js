/* BoardRoute facade: Plan→Draw→Compose for trunk groups; pairwise otherwise. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./board-route/world') : null);
  const Choose = root.BoardRouteChoose || (typeof require === 'function' ? require('./board-route/choose') : null);
  const Arrow = root.BoardRouteArrow || (typeof require === 'function' ? require('./board-route/arrow') : null);
  const Label = root.BoardRouteLabel || (typeof require === 'function' ? require('./board-route/label') : null);
  const Plan = root.BoardRoutePlan || (typeof require === 'function' ? require('./board-route/plan') : null);
  const Compose = root.BoardRouteCompose || (typeof require === 'function' ? require('./board-route/compose') : null);
  const Straight = root.BoardRouteStraight || (typeof require === 'function' ? require('./board-route/straight') : null);
  if (!World || !Choose || !Arrow || !Label || !Plan || !Compose || !Straight) throw new Error('BoardRoute parts are not loaded');
  const api = factory(World, Choose, Arrow, Label, Plan, Compose, Straight);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRoute = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (World, Choose, Arrow, Label, Plan, Compose, Straight) {
  'use strict';

  function rememberRoute(occupied, points) {
    for (let index = 1; index < points.length; index += 1) {
      occupied.push({ from: points[index - 1], to: points[index] });
    }
  }


  function drawPairwise(item, boxRects, parentOf, ownerOf, occupiedSegments, style) {
    const pack = item.selectedRoute || Choose.packFor(item, boxRects, parentOf, ownerOf);
    item.selectedRoute = pack;
    // Arrow min is a floor (ranked in pickCandidate); never paint-stretch into boxes.
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

  function route(input) {
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

  return { route, placeLabel: Label.place, sidePoint: World.sidePoint };
});
