/* BoardRoute world: geometry, hit tests, ports, obstacles. No fold search. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteWorld = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROUTE_SIDES = ['right', 'left', 'bottom', 'top'];
  const SIDE_INDEX = { right: 0, left: 1, bottom: 2, top: 3 };
  const OPPOSITE_SIDE = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' };
  const ROUTE_EPSILON = 0.001;
  const PORT_INSET = 0.08;
  const PORT_INSET_MAX = 24;
  const PORT_EDGE_PAD = 2;
  const RAIL_PAD = 24;
  const ROUTE_GAP = 24;
  const EDGE_STICK = 3; // 贴边: clearance <= this counts as collision
  const PORT_STEP_COUNT = 4;
  const portInset = (size) => Math.min(size * PORT_INSET, PORT_INSET_MAX);

  const normalizeCoord = (value) => {
    const rounded = Math.round(Number(value) * 1000) / 1000;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  const point = (x, y) => ({ x: normalizeCoord(x), y: normalizeCoord(y) });
  const pointKey = (value) => String(normalizeCoord(value.x)) + ',' + String(normalizeCoord(value.y));
  const samePoint = (a, b) => Math.abs(a.x - b.x) < ROUTE_EPSILON && Math.abs(a.y - b.y) < ROUTE_EPSILON;
  const routeDirection = (from, to) => {
    if (Math.abs(from.y - to.y) < ROUTE_EPSILON) return to.x >= from.x ? 'right' : 'left';
    if (Math.abs(from.x - to.x) < ROUTE_EPSILON) return to.y >= from.y ? 'bottom' : 'top';
    return null;
  };
  const sharedLength = (occupied, from, to) => {
    if (!occupied || !occupied.length) return 0;
    const horizontal = Math.abs(from.y - to.y) < ROUTE_EPSILON;
    const vertical = Math.abs(from.x - to.x) < ROUTE_EPSILON;
    if (!horizontal && !vertical) return 0;
    return occupied.reduce((total, segment) => {
      if (horizontal && Math.abs(segment.from.y - segment.to.y) < ROUTE_EPSILON && Math.abs(segment.from.y - from.y) < ROUTE_EPSILON) {
        return total + Math.max(0, Math.min(Math.max(from.x, to.x), Math.max(segment.from.x, segment.to.x)) - Math.max(Math.min(from.x, to.x), Math.min(segment.from.x, segment.to.x)));
      }
      if (vertical && Math.abs(segment.from.x - segment.to.x) < ROUTE_EPSILON && Math.abs(segment.from.x - from.x) < ROUTE_EPSILON) {
        return total + Math.max(0, Math.min(Math.max(from.y, to.y), Math.max(segment.from.y, segment.to.y)) - Math.max(Math.min(from.y, to.y), Math.min(segment.from.y, segment.to.y)));
      }
      return total;
    }, 0);
  };
  const rangesOverlap = (a0, a1, b0, b1) => (
    Math.min(a0, a1) < Math.max(b0, b1) - ROUTE_EPSILON
    && Math.min(b0, b1) < Math.max(a0, a1) - ROUTE_EPSILON
  );
  const parallelClearance = (points, occupied) => {
    if (!occupied || !occupied.length || !points || points.length < 2) return Infinity;
    let min = Infinity;
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const horizontal = Math.abs(from.y - to.y) < ROUTE_EPSILON;
      const vertical = Math.abs(from.x - to.x) < ROUTE_EPSILON;
      occupied.forEach((segment) => {
        if (horizontal && Math.abs(segment.from.y - segment.to.y) < ROUTE_EPSILON && rangesOverlap(from.x, to.x, segment.from.x, segment.to.x)) {
          min = Math.min(min, Math.abs(from.y - segment.from.y));
        }
        if (vertical && Math.abs(segment.from.x - segment.to.x) < ROUTE_EPSILON && rangesOverlap(from.y, to.y, segment.from.y, segment.to.y)) {
          min = Math.min(min, Math.abs(from.x - segment.from.x));
        }
      });
    }
    return min;
  };
  // Signed box clearance: outside > 0, flush edge ≈ 0, interior < 0 (penetration).
  const segmentBoxClearance = (from, to, obstacles) => {
    const horizontal = Math.abs(from.y - to.y) < ROUTE_EPSILON;
    const vertical = Math.abs(from.x - to.x) < ROUTE_EPSILON;
    if (!horizontal && !vertical) return 0;
    let min = Infinity;
    (obstacles || []).forEach((rect) => {
      if (horizontal) {
        if (!rangesOverlap(from.x, to.x, rect.left, rect.right)) return;
        if (from.y < rect.top - ROUTE_EPSILON) min = Math.min(min, rect.top - from.y);
        else if (from.y > rect.bottom + ROUTE_EPSILON) min = Math.min(min, from.y - rect.bottom);
        else min = Math.min(min, -Math.min(from.y - rect.top, rect.bottom - from.y));
        return;
      }
      if (!rangesOverlap(from.y, to.y, rect.top, rect.bottom)) return;
      if (from.x < rect.left - ROUTE_EPSILON) min = Math.min(min, rect.left - from.x);
      else if (from.x > rect.right + ROUTE_EPSILON) min = Math.min(min, from.x - rect.right);
      else min = Math.min(min, -Math.min(from.x - rect.left, rect.right - from.x));
    });
    return min;
  };
  const pathBoxClearance = (points, obstacles) => {
    if (!points || points.length < 2) return Infinity;
    let min = Infinity;
    for (let index = 1; index < points.length; index += 1) {
      min = Math.min(min, segmentBoxClearance(points[index - 1], points[index], obstacles));
    }
    return min;
  };
  const pointInside = (candidate, rect) => (
    candidate.x > rect.left + ROUTE_EPSILON
    && candidate.x < rect.right - ROUTE_EPSILON
    && candidate.y > rect.top + ROUTE_EPSILON
    && candidate.y < rect.bottom - ROUTE_EPSILON
  );
  const segmentHitsInterior = (a, b, rect) => {
    if (Math.abs(a.y - b.y) < ROUTE_EPSILON) {
      if (a.y <= rect.top + ROUTE_EPSILON || a.y >= rect.bottom - ROUTE_EPSILON) return false;
      const lo = Math.min(a.x, b.x);
      const hi = Math.max(a.x, b.x);
      return hi > rect.left + ROUTE_EPSILON && lo < rect.right - ROUTE_EPSILON;
    }
    if (Math.abs(a.x - b.x) < ROUTE_EPSILON) {
      if (a.x <= rect.left + ROUTE_EPSILON || a.x >= rect.right - ROUTE_EPSILON) return false;
      const lo = Math.min(a.y, b.y);
      const hi = Math.max(a.y, b.y);
      return hi > rect.top + ROUTE_EPSILON && lo < rect.bottom - ROUTE_EPSILON;
    }
    return true;
  };
  const simplifyRoute = (points) => {
    const compact = [];
    (points || []).forEach((candidate) => {
      if (!compact.length || !samePoint(compact[compact.length - 1], candidate)) compact.push(candidate);
    });
    for (let index = compact.length - 2; index > 0; index -= 1) {
      const before = compact[index - 1];
      const current = compact[index];
      const after = compact[index + 1];
      if (
        (Math.abs(before.x - current.x) < ROUTE_EPSILON && Math.abs(current.x - after.x) < ROUTE_EPSILON)
        || (Math.abs(before.y - current.y) < ROUTE_EPSILON && Math.abs(current.y - after.y) < ROUTE_EPSILON)
      ) compact.splice(index, 1);
    }
    return compact;
  };
  const svgNumber = (value) => String(normalizeCoord(value));
  const routePath = (points) => {
    if (!points || !points.length) return '';
    let d = 'M ' + svgNumber(points[0].x) + ' ' + svgNumber(points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      const before = points[index - 1];
      const current = points[index];
      if (Math.abs(before.x - current.x) < ROUTE_EPSILON) d += ' V ' + svgNumber(current.y);
      else if (Math.abs(before.y - current.y) < ROUTE_EPSILON) d += ' H ' + svgNumber(current.x);
      else d += ' L ' + svgNumber(current.x) + ' ' + svgNumber(current.y);
    }
    return d;
  };
  const routeLabel = (points) => {
    let best = null;
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      if (!best || length > best.length) best = { from, to, length };
    }
    if (!best) return { x: points[0].x, y: points[0].y };
    if (Math.abs(best.from.y - best.to.y) < ROUTE_EPSILON) {
      return { x: (best.from.x + best.to.x) / 2, y: best.from.y - 7 };
    }
    if (Math.abs(best.from.x - best.to.x) < ROUTE_EPSILON) {
      return { x: best.from.x + 6, y: (best.from.y + best.to.y) / 2 - 4 };
    }
    return { x: (best.from.x + best.to.x) / 2, y: (best.from.y + best.to.y) / 2 - 8 };
  };
  const pathLength = (points) => {
    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
      length += Math.abs(points[index].x - points[index - 1].x) + Math.abs(points[index].y - points[index - 1].y);
    }
    return length;
  };
  // Select-k collision: same signed clearance; threshold depends on folds.
  // folds 1/2 → EDGE_STICK (3); folds ≥3 → 0 (flush/negative count).
  // folds 1/2 → ≤3; folds ≥3 or omitted (post-k draw checks) → ≤0.
  const collisionLimit = (folds) => (folds != null && folds < 3 ? EDGE_STICK : 0);
  const pathHits = (points, obstacles, folds) => {
    if (!points || points.length < 2) return false;
    const limit = collisionLimit(folds);
    for (let index = 1; index < points.length; index += 1) {
      const clearance = segmentBoxClearance(points[index - 1], points[index], obstacles);
      if (Number.isFinite(clearance) && clearance <= limit + ROUTE_EPSILON) return true;
    }
    return false;
  };
  const validIO = (points, sourceSide, targetSide) => {
    if (!points || points.length < 2) return false;
    const first = routeDirection(points[0], points[1]);
    const last = routeDirection(points[points.length - 2], points[points.length - 1]);
    return first === sourceSide && last === OPPOSITE_SIDE[targetSide];
  };
  const sideVector = (side) => {
    if (side === 'right') return { x: 1, y: 0 };
    if (side === 'left') return { x: -1, y: 0 };
    if (side === 'bottom') return { x: 0, y: 1 };
    return { x: 0, y: -1 };
  };
  const rectCenter = (rect) => ({
    x: Number.isFinite(rect.x) ? rect.x : (rect.left + rect.right) / 2,
    y: Number.isFinite(rect.y) ? rect.y : (rect.top + rect.bottom) / 2,
  });
  const rectWidth = (rect) => Number.isFinite(rect.width) ? rect.width : rect.right - rect.left;
  const rectHeight = (rect) => Number.isFinite(rect.height) ? rect.height : rect.bottom - rect.top;
  const facingSide = (fromRect, toRect) => {
    const overlapX = Math.min(fromRect.right, toRect.right) - Math.max(fromRect.left, toRect.left);
    const overlapY = Math.min(fromRect.bottom, toRect.bottom) - Math.max(fromRect.top, toRect.top);
    const gapX = fromRect.right < toRect.left
      ? toRect.left - fromRect.right
      : toRect.right < fromRect.left ? fromRect.left - toRect.right : 0;
    const gapY = fromRect.bottom < toRect.top
      ? toRect.top - fromRect.bottom
      : toRect.bottom < fromRect.top ? fromRect.top - toRect.bottom : 0;
    if (overlapX > ROUTE_EPSILON && gapY > ROUTE_EPSILON) return fromRect.bottom <= toRect.top ? 'bottom' : 'top';
    if (overlapY > ROUTE_EPSILON && gapX > ROUTE_EPSILON) return fromRect.right <= toRect.left ? 'right' : 'left';
    const from = rectCenter(fromRect);
    const to = rectCenter(toRect);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  };

  function sidePoint(rect, side, ratio) {
    const t = Math.max(PORT_INSET, Math.min(1 - PORT_INSET, ratio == null ? 0.5 : ratio));
    if (rect.kind === 'diamond') {
      if (side === 'left') return { x: rect.x - rect.width / 2, y: rect.y };
      if (side === 'right') return { x: rect.x + rect.width / 2, y: rect.y };
      if (side === 'top') return { x: rect.x, y: rect.y - rect.height / 2 };
      return { x: rect.x, y: rect.y + rect.height / 2 };
    }
    if (side === 'left' || side === 'right') {
      return { x: side === 'left' ? rect.left : rect.right, y: rect.top + rectHeight(rect) * t };
    }
    return { x: rect.left + rectWidth(rect) * t, y: side === 'top' ? rect.top : rect.bottom };
  }

  function recordTree(views) {
    const parentOf = new Map();
    const ownerOf = new Map();
    const walk = (box, parentId) => {
      parentOf.set(box.id, parentId || null);
      (box.items || []).forEach((item) => { if (item.id) ownerOf.set(item.id, box.id); });
      (box.boxes || []).forEach((child) => walk(child, box.id));
    };
    (views || []).forEach((node) => {
      if (node && (node.role === 'item' || node.kind === 'item')) {
        if (node.id) parentOf.set(node.id, null);
        return;
      }
      walk(node, null);
    });
    return { parentOf, ownerOf };
  }

  function endpointRooms(ownerOf, parentOf, endpointId) {
    const rooms = new Set();
    if (endpointId) rooms.add(endpointId);
    let cursor = ownerOf.get(endpointId) || parentOf.get(endpointId) || null;
    while (cursor && !rooms.has(cursor)) {
      rooms.add(cursor);
      cursor = parentOf.get(cursor) || null;
    }
    return rooms;
  }

  function obstaclesFor(boxRects, parentOf, ownerOf, fromId, toId) {
    const rooms = endpointRooms(ownerOf, parentOf, fromId);
    endpointRooms(ownerOf, parentOf, toId).forEach((id) => rooms.add(id));
    return Array.from(boxRects.values()).filter((rect) => {
      if (rooms.has(rect.id)) return false;
      let parentId = parentOf.get(rect.id) || ownerOf.get(rect.id) || null;
      while (parentId) {
        if (!rooms.has(parentId) && boxRects.has(parentId)) return false;
        parentId = parentOf.get(parentId) || null;
      }
      return true;
    });
  }


  function expandBounds(bounds, pad) {
    if (!bounds) return null;
    const p = Number.isFinite(pad) ? pad : 0;
    return {
      left: bounds.left - p,
      right: bounds.right + p,
      top: bounds.top - p,
      bottom: bounds.bottom + p,
    };
  }

  function boundsOverlap(a, b) {
    if (!a || !b) return false;
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }

  // Endpoint-hull corridor: pad around ports only (not the global obstacle AABB).
  function linkCorridor(portPoints, pad) {
    const base = boundsOf([], portPoints);
    return expandBounds(base, pad == null ? (RAIL_PAD + ROUTE_GAP) : pad);
  }

  // Rail seeds may only come from obstacles that intersect this link's corridor.
  // Collision still uses the full obstacle list separately.
  function railSeedObstacles(obstacles, corridor) {
    if (!corridor) return [];
    return (obstacles || []).filter((rect) => boundsOverlap(rect, corridor));
  }

  function foldRailCoordinates(portPoints, obstacles, axis) {
    const corridor = linkCorridor(portPoints);
    const seeds = railSeedObstacles(obstacles, corridor);
    const horizontal = axis === 'x';
    const portCoords = (portPoints || []).map((entry) => {
      const pt = entry.point || entry;
      return horizontal ? pt.x : pt.y;
    });
    const midCoords = [];
    for (let i = 0; i < (portPoints || []).length; i += 1) {
      for (let j = i + 1; j < portPoints.length; j += 1) {
        const a = portPoints[i].point || portPoints[i];
        const b = portPoints[j].point || portPoints[j];
        midCoords.push(horizontal ? (a.x + b.x) / 2 : (a.y + b.y) / 2);
      }
    }
    const edgeCoords = seeds.flatMap((rect) => (
      horizontal
        ? [rect.left, rect.right, rect.left - ROUTE_GAP, rect.right + ROUTE_GAP]
        : [rect.top, rect.bottom, rect.top - ROUTE_GAP, rect.bottom + ROUTE_GAP]
    ));
    const padCoords = corridor
      ? (horizontal
        ? [corridor.left - RAIL_PAD, corridor.right + RAIL_PAD]
        : [corridor.top - RAIL_PAD, corridor.bottom + RAIL_PAD])
      : [];
    return uniqueCoordinates(portCoords.concat(midCoords).concat(edgeCoords).concat(padCoords));
  }

  function uniqueCoordinates(values) {
    const byValue = new Map();
    values.forEach((value) => {
      const normalized = normalizeCoord(value);
      if (Number.isFinite(normalized)) byValue.set(String(normalized), normalized);
    });
    return Array.from(byValue.values()).sort((a, b) => a - b);
  }

  function densifyCoordinates(values, minGap) {
    const out = [];
    values.forEach((value, index) => {
      out.push(value);
      const next = values[index + 1];
      if (next != null && next - value > minGap) out.push((value + next) / 2);
    });
    return uniqueCoordinates(out);
  }

  function boundsOf(rects, ports) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    (rects || []).forEach((rect) => {
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      top = Math.min(top, rect.top);
      bottom = Math.max(bottom, rect.bottom);
    });
    (ports || []).forEach((entry) => {
      const candidate = entry.point || entry;
      left = Math.min(left, candidate.x);
      right = Math.max(right, candidate.x);
      top = Math.min(top, candidate.y);
      bottom = Math.max(bottom, candidate.y);
    });
    if (!Number.isFinite(left)) return null;
    return { left, right, top, bottom };
  }

  function sideAlongCoord(side, port) {
    if (!port || !port.point) return NaN;
    return side === 'left' || side === 'right' ? port.point.y : port.point.x;
  }

  function runHits(horizontal, span0, span1, coord, obstacles) {
    const from = horizontal ? point(span0, coord) : point(coord, span0);
    const to = horizontal ? point(span1, coord) : point(coord, span1);
    // Interior only — clamp still seeks ROUTE_GAP via want; narrow bands may skim.
    return (obstacles || []).some((rect) => segmentHitsInterior(from, to, rect));
  }

  function trappedSkim(horizontal, span0, span1, coord, obstacles) {
    let best = null;
    (obstacles || []).forEach((rect) => {
      if (horizontal) {
        if (!rangesOverlap(span0, span1, rect.left, rect.right)) return;
        if (coord <= rect.top + ROUTE_EPSILON || coord >= rect.bottom - ROUTE_EPSILON) return;
        const up = coord - rect.top;
        const down = rect.bottom - coord;
        const cand = up <= down
          ? { rect, edge: rect.top, gap: 0, away: -1, horizontal: true, depth: up }
          : { rect, edge: rect.bottom, gap: 0, away: 1, horizontal: true, depth: down };
        if (!best || cand.depth < best.depth) best = cand;
        return;
      }
      if (!rangesOverlap(span0, span1, rect.top, rect.bottom)) return;
      if (coord <= rect.left + ROUTE_EPSILON || coord >= rect.right - ROUTE_EPSILON) return;
      const left = coord - rect.left;
      const right = rect.right - coord;
      const cand = left <= right
        ? { rect, edge: rect.left, gap: 0, away: -1, horizontal: false, depth: left }
        : { rect, edge: rect.right, gap: 0, away: 1, horizontal: false, depth: right };
      if (!best || cand.depth < best.depth) best = cand;
    });
    return best;
  }

  function nearestSkim(horizontal, span0, span1, coord, obstacles) {
    let best = null;
    (obstacles || []).forEach((rect) => {
      if (horizontal) {
        if (!rangesOverlap(span0, span1, rect.left, rect.right)) return;
        if (coord <= rect.top + ROUTE_EPSILON) {
          const gap = rect.top - coord;
          if (!best || gap < best.gap) best = { rect, edge: rect.top, gap, away: -1, horizontal: true };
          return;
        }
        if (coord >= rect.bottom - ROUTE_EPSILON) {
          const gap = coord - rect.bottom;
          if (!best || gap < best.gap) best = { rect, edge: rect.bottom, gap, away: 1, horizontal: true };
        }
        return;
      }
      if (!rangesOverlap(span0, span1, rect.top, rect.bottom)) return;
      if (coord <= rect.left + ROUTE_EPSILON) {
        const gap = rect.left - coord;
        if (!best || gap < best.gap) best = { rect, edge: rect.left, gap, away: -1, horizontal: false };
        return;
      }
      if (coord >= rect.right - ROUTE_EPSILON) {
        const gap = coord - rect.right;
        if (!best || gap < best.gap) best = { rect, edge: rect.right, gap, away: 1, horizontal: false };
      }
    });
    return best;
  }

  function farthestLegal(skim, span0, span1, center, obstacles, bandLo, bandHi) {
    const dest = skim.away < 0 ? bandLo : bandHi;
    const edges = [dest, center];
    (obstacles || []).forEach((rect) => {
      if (skim.horizontal) {
        if (!rangesOverlap(span0, span1, rect.left, rect.right)) return;
        // Prefer rails at ROUTE_GAP outside the box; flush edges fail runHits.
        edges.push(rect.top - ROUTE_GAP, rect.top, rect.bottom, rect.bottom + ROUTE_GAP);
        return;
      }
      if (!rangesOverlap(span0, span1, rect.top, rect.bottom)) return;
      edges.push(rect.left - ROUTE_GAP, rect.left, rect.right, rect.right + ROUTE_GAP);
    });
    const legal = uniqueCoordinates(edges).filter((coord) => {
      if (skim.away < 0 && coord > center + ROUTE_EPSILON) return false;
      if (skim.away > 0 && coord < center - ROUTE_EPSILON) return false;
      if (coord < bandLo - ROUTE_EPSILON || coord > bandHi + ROUTE_EPSILON) return false;
      return !runHits(skim.horizontal, span0, span1, coord, obstacles);
    });
    if (!legal.length) return center;
    return skim.away < 0 ? Math.min.apply(null, legal) : Math.max.apply(null, legal);
  }

  function clampedCoord(horizontal, span0, span1, center, obstacles, bandLo, bandHi) {
    if (!Number.isFinite(center) || !Number.isFinite(span0) || !Number.isFinite(span1)) return center;
    if (bandHi < bandLo) return center;
    const skim = trappedSkim(horizontal, span0, span1, center, obstacles)
      || nearestSkim(horizontal, span0, span1, center, obstacles);
    if (!skim) return center;
    const far = farthestLegal(skim, span0, span1, center, obstacles, bandLo, bandHi);
    const x = Math.max(0, skim.away < 0 ? skim.edge - far : far - skim.edge);
    const want = Math.min(x, Math.max(ROUTE_GAP, Math.max(0, skim.gap)));
    return skim.away < 0 ? skim.edge - want : skim.edge + want;
  }

  function outwardFar(rect, side, mate) {
    const pad = RAIL_PAD + ROUTE_GAP;
    const mateCenter = mate ? rectCenter(mate) : null;
    if (side === 'right') return mateCenter && mateCenter.x > rect.right ? mateCenter.x : rect.right + pad;
    if (side === 'left') return mateCenter && mateCenter.x < rect.left ? mateCenter.x : rect.left - pad;
    if (side === 'bottom') return mateCenter && mateCenter.y > rect.bottom ? mateCenter.y : rect.bottom + pad;
    return mateCenter && mateCenter.y < rect.top ? mateCenter.y : rect.top - pad;
  }

  function clampedSideCoord(rect, side, mate, obstacles) {
    if (!rect || !side) return NaN;
    const center = rectCenter(rect);
    const far = outwardFar(rect, side, mate);
    if (side === 'right' || side === 'left') {
      return clampedCoord(true, side === 'right' ? rect.right : rect.left, far, center.y, obstacles, rect.top, rect.bottom);
    }
    return clampedCoord(false, side === 'bottom' ? rect.bottom : rect.top, far, center.x, obstacles, rect.left, rect.right);
  }

  function geometricCenterBias(candidate) {
    // Port bias = distance from that box's side mid.
    // k=1: one shared run. |a−b| ties the two side-mids equally; max(a,b)
    //   is unique at the midpoint between mids (equal distance, no favor).
    // k>1: each end only its own fold — score a + b.
    const a = (candidate && candidate.source && candidate.source.bias) || 0;
    const b = (candidate && candidate.target && candidate.target.bias) || 0;
    const folds = candidate && candidate.folds;
    if (folds === 1) return Math.max(a, b);
    return a + b;
  }

  function clampAlongSide(rect, side, raw, inset) {
    const width = rectWidth(rect);
    const height = rectHeight(rect);
    const clamp = (lo, hi, size, mid, value) => {
      const pad = inset == null ? portInset(size) : inset;
      const min = lo + pad;
      const max = hi - pad;
      return min <= max ? Math.max(min, Math.min(max, value)) : mid;
    };
    if (side === 'left' || side === 'right') {
      const mid = rect.top + height * 0.5;
      const y = clamp(rect.top, rect.bottom, height, mid, raw);
      return {
        point: point(side === 'left' ? rect.left : rect.right, y),
        bias: Math.abs(y - mid),
      };
    }
    const mid = rect.left + width * 0.5;
    const x = clamp(rect.left, rect.right, width, mid, raw);
    return {
      point: point(x, side === 'top' ? rect.top : rect.bottom),
      bias: Math.abs(x - mid),
    };
  }

  function freePorts(pt, dirs) {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return [];
    const sides = dirs && dirs.length ? dirs : ROUTE_SIDES;
    return sides.map((side) => ({ side, point: point(pt.x, pt.y), bias: 0 }));
  }

  function attachmentPorts(rect, mate, obstacles) {
    if (!rect || !(rectWidth(rect) > 2 && rectHeight(rect) > 2)) return [];
    if (rect.kind === 'diamond') {
      return ROUTE_SIDES.map((side) => {
        const candidate = sidePoint(rect, side, 0.5);
        return { side, point: point(candidate.x, candidate.y), bias: 0 };
      });
    }
    const ports = [];
    const seen = new Set();
    const add = (side, raw, inset) => {
      if (!Number.isFinite(raw)) return;
      const entry = clampAlongSide(rect, side, raw, inset);
      const key = side + ':' + pointKey(entry.point);
      if (seen.has(key)) return;
      seen.add(key);
      ports.push({ side, point: entry.point, bias: entry.bias });
    };
    const center = rectCenter(rect);
    const mateCenter = mate ? rectCenter(mate) : null;
    // Mate projections stay on the edge. A % inset on a wide band would
    // drop the shared x/y that makes 1-fold legal under a box at the end.
    const addSteps = (side, origin, inset) => {
      add(side, origin, inset);
      for (let step = 1; step <= PORT_STEP_COUNT; step += 1) {
        add(side, origin + step * ROUTE_GAP, inset);
        add(side, origin - step * ROUTE_GAP, inset);
      }
    };
    ROUTE_SIDES.forEach((side) => {
      addSteps(side, side === 'left' || side === 'right' ? center.y : center.x);
      if (!mate) return;
      // Midpoint between both side-centers — the unique equal-distance port.
      if (side === 'left' || side === 'right') {
        add(side, (center.y + mateCenter.y) / 2, PORT_EDGE_PAD);
        addSteps(side, mateCenter.y, PORT_EDGE_PAD);
        add(side, mate.top, PORT_EDGE_PAD);
        add(side, mate.bottom, PORT_EDGE_PAD);
        const lo = Math.max(rect.top + PORT_EDGE_PAD, mate.top);
        const hi = Math.min(rect.bottom - PORT_EDGE_PAD, mate.bottom);
        if (hi > lo + ROUTE_EPSILON) add(side, (lo + hi) / 2, PORT_EDGE_PAD);
        return;
      }
      add(side, (center.x + mateCenter.x) / 2, PORT_EDGE_PAD);
      addSteps(side, mateCenter.x, PORT_EDGE_PAD);
      add(side, mate.left, PORT_EDGE_PAD);
      add(side, mate.right, PORT_EDGE_PAD);
      const lo = Math.max(rect.left + PORT_EDGE_PAD, mate.left);
      const hi = Math.min(rect.right - PORT_EDGE_PAD, mate.right);
      if (hi > lo + ROUTE_EPSILON) add(side, (lo + hi) / 2, PORT_EDGE_PAD);
    });
    if (mate && obstacles && obstacles.length) {
      ROUTE_SIDES.forEach((side) => {
        const raw = clampedSideCoord(rect, side, mate, obstacles);
        if (Number.isFinite(raw)) add(side, raw, 0);
      });
    }
    return ports;
  }

  function makeCandidate(source, target, points) {
    const simplified = simplifyRoute(points);
    return {
      source,
      target,
      points: simplified,
      folds: simplified.length - 1,
      length: pathLength(simplified),
    };
  }

  function acceptRouted(source, target, points, obstacles, folds) {
    const simplified = simplifyRoute(points);
    if (simplified.length < 2) return null;
    if (!validIO(simplified, source.side, target.side)) return null;
    if (pathHits(simplified, obstacles, folds)) return null;
    return makeCandidate(source, target, simplified);
  }

  function acceptCandidate(source, target, points, obstacles, folds) {
    const found = acceptRouted(source, target, points, obstacles, folds);
    if (!found || found.folds !== folds) return null;
    return found;
  }

  return {
    ROUTE_SIDES,
    SIDE_INDEX,
    OPPOSITE_SIDE,
    ROUTE_EPSILON,
    RAIL_PAD,
    ROUTE_GAP,
    EDGE_STICK,
    point,
    pointKey,
    samePoint,
    routeDirection,
    sharedLength,
    parallelClearance,
    pathBoxClearance,
    pointInside,
    segmentHitsInterior,
    simplifyRoute,
    routePath,
    routeLabel,
    pathLength,
    pathHits,
    collisionLimit,
    validIO,
    sideVector,
    facingSide,
    sidePoint,
    recordTree,
    obstaclesFor,
    expandBounds,
    boundsOverlap,
    linkCorridor,
    railSeedObstacles,
    foldRailCoordinates,
    uniqueCoordinates,
    densifyCoordinates,
    boundsOf,
    freePorts,
    attachmentPorts,
    clampedCoord,
    clampedSideCoord,
    geometricCenterBias,
    makeCandidate,
    acceptRouted,
    acceptCandidate,
  };
});
