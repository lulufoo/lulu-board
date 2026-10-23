/* BoardRoute fallback: lead-rails and grid. Only after 1..3 folds are empty. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  if (!World) throw new Error('BoardRouteWorld is not loaded');
  const api = factory(World);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteFallback = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W) {
  'use strict';

  const BEND_WEIGHT = 1000000;
  const LEAD = 12;
  const DENSIFY_GAP = 8;

  function leadPoint(port) {
    if (port.side === 'right') return W.point(port.point.x + LEAD, port.point.y);
    if (port.side === 'left') return W.point(port.point.x - LEAD, port.point.y);
    if (port.side === 'bottom') return W.point(port.point.x, port.point.y + LEAD);
    return W.point(port.point.x, port.point.y - LEAD);
  }

  function enumerateLeadRails(sourcePorts, targetPorts, obstacles) {
    const batch = [];
    const portPoints = sourcePorts.map((entry) => entry.point).concat(targetPorts.map((entry) => entry.point));
    // Same corridor rail rule as k=3 search — do not seed from far boxes.
    const railXs = W.foldRailCoordinates(portPoints, obstacles, 'x');
    const railYs = W.foldRailCoordinates(portPoints, obstacles, 'y');
    sourcePorts.forEach((source) => {
      targetPorts.forEach((target) => {
        const leadS = leadPoint(source);
        const leadT = leadPoint(target);
        railYs.forEach((railY) => {
          const found = W.acceptRouted(source, target, [
            source.point, leadS, W.point(leadS.x, railY), W.point(leadT.x, railY), leadT, target.point,
          ], obstacles);
          if (found) batch.push(found);
        });
        railXs.forEach((railX) => {
          const found = W.acceptRouted(source, target, [
            source.point, leadS, W.point(railX, leadS.y), W.point(railX, leadT.y), leadT, target.point,
          ], obstacles);
          if (found) batch.push(found);
        });
      });
    });
    return batch;
  }

  function buildRouteGrid(ports, obstacles) {
    const corridor = W.linkCorridor(ports);
    const seeds = W.railSeedObstacles(obstacles, corridor);
    const env = corridor || W.boundsOf(seeds, ports);
    let xs = W.uniqueCoordinates(
      ports.map((entry) => entry.x)
        .concat(seeds.flatMap((rect) => [rect.left, rect.right]))
        .concat(env ? [env.left - W.RAIL_PAD, env.right + W.RAIL_PAD] : []),
    );
    let ys = W.uniqueCoordinates(
      ports.map((entry) => entry.y)
        .concat(seeds.flatMap((rect) => [rect.top, rect.bottom]))
        .concat(env ? [env.top - W.RAIL_PAD, env.bottom + W.RAIL_PAD] : []),
    );
    xs = W.densifyCoordinates(xs, DENSIFY_GAP);
    ys = W.densifyCoordinates(ys, DENSIFY_GAP);
    if (!xs.length || !ys.length) return null;
    const nodes = [];
    const nodeByPoint = new Map();
    const cells = Array.from({ length: ys.length }, () => Array(xs.length).fill(-1));
    ys.forEach((y, yIndex) => {
      xs.forEach((x, xIndex) => {
        const candidate = W.point(x, y);
        if ((obstacles || []).some((rect) => W.pointInside(candidate, rect))) return;
        const id = nodes.length;
        nodes.push(candidate);
        cells[yIndex][xIndex] = id;
        nodeByPoint.set(W.pointKey(candidate), id);
      });
    });
    const adjacency = Array.from({ length: nodes.length }, () => []);
    const connect = (fromId, toId) => {
      if (fromId < 0 || toId < 0 || fromId === toId) return;
      const from = nodes[fromId];
      const to = nodes[toId];
      const direction = W.routeDirection(from, to);
      const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      if (!direction || length < W.ROUTE_EPSILON || (obstacles || []).some((rect) => W.segmentHitsInterior(from, to, rect))) return;
      adjacency[fromId].push({ to: toId, direction, length });
      adjacency[toId].push({ to: fromId, direction: W.OPPOSITE_SIDE[direction], length });
    };
    cells.forEach((row) => {
      let previous = -1;
      row.forEach((current) => {
        if (current < 0) return;
        if (previous >= 0) connect(previous, current);
        previous = current;
      });
    });
    xs.forEach((_, xIndex) => {
      let previous = -1;
      ys.forEach((_, yIndex) => {
        const current = cells[yIndex][xIndex];
        if (current < 0) return;
        if (previous >= 0) connect(previous, current);
        previous = current;
      });
    });
    return { nodes, nodeByPoint, adjacency };
  }

  const routeEntryBefore = (a, b) => (
    a.cost < b.cost - W.ROUTE_EPSILON
    || (Math.abs(a.cost - b.cost) < W.ROUTE_EPSILON && (
      a.tie < b.tie - W.ROUTE_EPSILON
      || (Math.abs(a.tie - b.tie) < W.ROUTE_EPSILON && a.order < b.order)
    ))
  );
  const pushRouteEntry = (heap, entry) => {
    heap.push(entry);
    for (let index = heap.length - 1; index > 0;) {
      const parent = Math.floor((index - 1) / 2);
      if (!routeEntryBefore(heap[index], heap[parent])) break;
      [heap[index], heap[parent]] = [heap[parent], heap[index]];
      index = parent;
    }
  };
  const popRouteEntry = (heap) => {
    const first = heap[0];
    const last = heap.pop();
    if (!heap.length) return first;
    heap[0] = last;
    for (let index = 0;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let next = index;
      if (left < heap.length && routeEntryBefore(heap[left], heap[next])) next = left;
      if (right < heap.length && routeEntryBefore(heap[right], heap[next])) next = right;
      if (next === index) break;
      [heap[index], heap[next]] = [heap[next], heap[index]];
      index = next;
    }
    return first;
  };

  function routeOnGrid(grid, source, target, sourceSide, targetSide, occupied, preference) {
    if (!grid) return null;
    const sourceId = grid.nodeByPoint.get(W.pointKey(source));
    const targetId = grid.nodeByPoint.get(W.pointKey(target));
    if (sourceId == null || targetId == null || sourceId === targetId) return null;
    const sourceDirection = sourceSide;
    const targetDirection = W.OPPOSITE_SIDE[targetSide];
    const stateCount = grid.nodes.length * W.ROUTE_SIDES.length;
    const best = Array(stateCount).fill(null);
    const previous = Array(stateCount).fill(-1);
    const firstState = sourceId * W.ROUTE_SIDES.length + W.SIDE_INDEX[sourceDirection];
    const first = { state: firstState, cost: 0, tie: 0, order: 0 };
    best[firstState] = first;
    const heap = [first];
    let order = 1;
    let finalState = -1;
    while (heap.length) {
      const current = popRouteEntry(heap);
      const known = best[current.state];
      if (!known || known.cost !== current.cost || known.tie !== current.tie) continue;
      const nodeId = Math.floor(current.state / W.ROUTE_SIDES.length);
      const direction = W.ROUTE_SIDES[current.state % W.ROUTE_SIDES.length];
      if (nodeId === targetId && direction === targetDirection) {
        finalState = current.state;
        break;
      }
      (grid.adjacency[nodeId] || []).forEach((edge) => {
        if (nodeId === sourceId && edge.direction !== sourceDirection) return;
        if (edge.to === targetId && edge.direction !== targetDirection) return;
        const nextState = edge.to * W.ROUTE_SIDES.length + W.SIDE_INDEX[edge.direction];
        const turns = edge.direction === direction ? 0 : 1;
        const cost = current.cost + edge.length + turns * BEND_WEIGHT;
        let tie = current.tie;
        // Stagger only: penalize overlap. Trunk trunks come from Plan, not overlap.
        const overlap = W.sharedLength(occupied, grid.nodes[nodeId], grid.nodes[edge.to]);
        if (overlap > W.ROUTE_EPSILON && preference === 'stagger') tie += overlap;
        const next = { state: nextState, cost, tie, order: order += 1 };
        const prior = best[nextState];
        if (prior && !routeEntryBefore(next, prior)) return;
        best[nextState] = next;
        previous[nextState] = current.state;
        pushRouteEntry(heap, next);
      });
    }
    if (finalState < 0) return null;
    const points = [];
    for (let state = finalState; state >= 0; state = previous[state]) {
      points.push(grid.nodes[Math.floor(state / W.ROUTE_SIDES.length)]);
    }
    points.reverse();
    const simplified = W.simplifyRoute(points);
    if (!W.validIO(simplified, sourceSide, targetSide) || W.pathHits(simplified, [])) return null;
    return { points: simplified, folds: simplified.length - 1, length: W.pathLength(simplified), cost: best[finalState].cost, tie: best[finalState].tie };
  }

  function gridFallback(sourcePorts, targetPorts, obstacles) {
    const portPoints = sourcePorts.map((entry) => entry.point)
      .concat(targetPorts.map((entry) => entry.point))
      .concat(sourcePorts.map(leadPoint))
      .concat(targetPorts.map(leadPoint));
    const grid = buildRouteGrid(portPoints, obstacles);
    if (!grid) return null;
    let bestFolds = Infinity;
    const batch = [];
    sourcePorts.forEach((source) => {
      targetPorts.forEach((target) => {
        const found = routeOnGrid(grid, source.point, target.point, source.side, target.side, null, null);
        if (!found) return;
        if (found.folds < bestFolds) {
          bestFolds = found.folds;
          batch.length = 0;
        }
        if (found.folds === bestFolds) {
          batch.push({
            source,
            target,
            points: found.points,
            folds: found.folds,
            length: found.length,
          });
        }
      });
    });
    return batch.length ? { k: bestFolds, batch } : null;
  }

  return { enumerateLeadRails, gridFallback };
});
