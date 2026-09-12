/* BoardRoute plan: trunk groups → Junction → tree segments (N branch + 1 trunk). */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  const Choose = root.BoardRouteChoose || (typeof require === 'function' ? require('./choose') : null);
  if (!World || !Choose) throw new Error('BoardRoute plan deps are not loaded');
  const api = factory(World, Choose);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRoutePlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W, Choose) {
  'use strict';

  const BEND_PENALTY = 48;
  const MIN_TRUNK = () => 2 * W.ROUTE_GAP;
  const ALL_DIRS = () => W.ROUTE_SIDES.slice();

  function linkKey(item) {
    if (item && item.linkIndex != null) return 'i:' + item.linkIndex;
    return 'e:' + String(item && item.from) + '>' + String(item && item.to);
  }

  function rectOf(item, end, boxRects) {
    if (end === 'from') return item.fromRect || (boxRects && boxRects.get(item.from)) || null;
    return item.toRect || (boxRects && boxRects.get(item.to)) || null;
  }

  function clusterBounds(rects) {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    (rects || []).forEach((rect) => {
      if (!rect) return;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      top = Math.min(top, rect.top);
      bottom = Math.max(bottom, rect.bottom);
    });
    if (!Number.isFinite(left)) return null;
    return { left, right, top, bottom, x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top };
  }

  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
    if (!sorted.length) return NaN;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function outsideBoxes(pt, boxRects) {
    if (!pt) return false;
    return !Array.from((boxRects && boxRects.values()) || []).some((rect) => W.pointInside(pt, rect));
  }

  function freeMate(pt) {
    return {
      left: pt.x - 1,
      right: pt.x + 1,
      top: pt.y - 1,
      bottom: pt.y + 1,
      x: pt.x,
      y: pt.y,
      width: 2,
      height: 2,
    };
  }

  function groupLinks(items, style) {
    if (style !== 'trunk') {
      return { groups: [], fallback: (items || []).slice() };
    }
    const fanIn = new Map();
    const fanOut = new Map();
    (items || []).forEach((item) => {
      if (!item || item.from == null || item.to == null || item.from === item.to) return;
      if (!fanIn.has(item.to)) fanIn.set(item.to, []);
      fanIn.get(item.to).push(item);
      if (!fanOut.has(item.from)) fanOut.set(item.from, []);
      fanOut.get(item.from).push(item);
    });
    const claimed = new Set();
    const groups = [];
    const pushGroup = (kind, hub, links) => {
      const usable = links.filter((item) => !claimed.has(linkKey(item)));
      if (usable.length < 3) return;
      usable.forEach((item) => claimed.add(linkKey(item)));
      groups.push({ kind, hub, links: usable });
    };
    fanIn.forEach((links, hub) => pushGroup('fan-in', hub, links));
    fanOut.forEach((links, hub) => pushGroup('fan-out', hub, links));
    const fallback = (items || []).filter((item) => !claimed.has(linkKey(item)));
    return { groups, fallback };
  }

  function hubAndLeaves(group, boxRects) {
    const hubRect = group.kind === 'fan-in'
      ? rectOf(group.links[0], 'to', boxRects)
      : rectOf(group.links[0], 'from', boxRects);
    const leafRects = group.links.map((item) => (
      group.kind === 'fan-in' ? rectOf(item, 'from', boxRects) : rectOf(item, 'to', boxRects)
    ));
    const cluster = clusterBounds(leafRects);
    return { hubRect, leafRects, cluster };
  }

  function candidatePoints(group, boxRects, obstacles) {
    const { hubRect, leafRects, cluster } = hubAndLeaves(group, boxRects);
    if (!hubRect || !cluster) return [];
    const hubSide = W.facingSide(hubRect, cluster);
    const pts = [];
    const seen = new Set();
    const add = (x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const pt = W.point(x, y);
      const key = W.pointKey(pt);
      if (seen.has(key)) return;
      seen.add(key);
      if (!outsideBoxes(pt, boxRects)) return;
      pts.push(pt);
    };

    const midX = median(leafRects.map((rect) => (rect.left + rect.right) / 2));
    const midY = median(leafRects.map((rect) => (rect.top + rect.bottom) / 2));
    const gap = W.ROUTE_GAP;
    const pad = W.RAIL_PAD;

    const alongHub = (dist, yOrX) => {
      if (hubSide === 'left') add(hubRect.left - dist, yOrX);
      else if (hubSide === 'right') add(hubRect.right + dist, yOrX);
      else if (hubSide === 'top') add(yOrX, hubRect.top - dist);
      else add(yOrX, hubRect.bottom + dist);
    };

    // Hub outward grid + median leaf axis.
    for (let step = 2; step <= 8; step += 1) {
      const dist = step * gap;
      if (hubSide === 'left' || hubSide === 'right') {
        alongHub(dist, midY);
        leafRects.forEach((rect) => alongHub(dist, (rect.top + rect.bottom) / 2));
      } else {
        alongHub(dist, midX);
        leafRects.forEach((rect) => alongHub(dist, (rect.left + rect.right) / 2));
      }
    }

    // Corridor midpoints between cluster and hub.
    if (hubSide === 'left') {
      const x = (cluster.right + hubRect.left) / 2;
      add(x, midY);
      leafRects.forEach((rect) => add(x, (rect.top + rect.bottom) / 2));
    } else if (hubSide === 'right') {
      const x = (hubRect.right + cluster.left) / 2;
      add(x, midY);
      leafRects.forEach((rect) => add(x, (rect.top + rect.bottom) / 2));
    } else if (hubSide === 'top') {
      const y = (cluster.bottom + hubRect.top) / 2;
      add(midX, y);
      leafRects.forEach((rect) => add((rect.left + rect.right) / 2, y));
    } else {
      const y = (hubRect.bottom + cluster.top) / 2;
      add(midX, y);
      leafRects.forEach((rect) => add((rect.left + rect.right) / 2, y));
    }

    // Obstacle edges ± ROUTE_GAP near the corridor.
    (obstacles || []).forEach((rect) => {
      if (hubSide === 'left' || hubSide === 'right') {
        add(rect.left - gap, midY);
        add(rect.right + gap, midY);
        add(rect.left - gap - pad, midY);
        add(rect.right + gap + pad, midY);
        leafRects.forEach((leaf) => {
          const y = (leaf.top + leaf.bottom) / 2;
          add(rect.left - gap, y);
          add(rect.right + gap, y);
        });
      } else {
        add(midX, rect.top - gap);
        add(midX, rect.bottom + gap);
        add(midX, rect.top - gap - pad);
        add(midX, rect.bottom + gap + pad);
        leafRects.forEach((leaf) => {
          const x = (leaf.left + leaf.right) / 2;
          add(x, rect.top - gap);
          add(x, rect.bottom + gap);
        });
      }
    });

    return pts;
  }

  function drawEnd(itemLike, boxRects, parentOf, ownerOf) {
    const pack = Choose.packFor(itemLike, boxRects, parentOf, ownerOf);
    if (!pack || !pack.batch || !pack.batch.length) return null;
    const fromRect = itemLike.fromRect || (itemLike.fromFree ? freeMate(itemLike.fromFree.point) : null);
    const toRect = itemLike.toRect || (itemLike.toFree ? freeMate(itemLike.toFree.point) : null);
    const picked = Choose.pickCandidate(pack.batch, [], 'trunk', fromRect, toRect, pack.obstacles);
    if (!picked || !picked.points || picked.points.length < 2) return null;
    if (W.pathHits(picked.points, pack.obstacles, picked.folds)) return null;
    return {
      points: picked.points,
      source: picked.source,
      target: picked.target,
      folds: picked.folds,
      length: W.pathLength(picked.points),
      obstacles: pack.obstacles,
    };
  }

  function segmentCost(drawn) {
    if (!drawn) return Infinity;
    return drawn.length + drawn.folds * BEND_PENALTY;
  }

  function tryJunction(group, junction, boxRects, parentOf, ownerOf) {
    const dirs = ALL_DIRS();
    const free = { point: junction, dirs };
    const branches = [];
    let obstacles = null;

    for (let index = 0; index < group.links.length; index += 1) {
      const item = group.links[index];
      let drawn;
      if (group.kind === 'fan-in') {
        drawn = drawEnd({
          from: item.from,
          to: null,
          fromRect: rectOf(item, 'from', boxRects),
          toFree: free,
        }, boxRects, parentOf, ownerOf);
      } else {
        drawn = drawEnd({
          from: null,
          to: item.to,
          fromFree: free,
          toRect: rectOf(item, 'to', boxRects),
        }, boxRects, parentOf, ownerOf);
      }
      if (!drawn) return null;
      branches.push({ item, drawn });
      obstacles = drawn.obstacles;
    }

    let trunk;
    const hubItem = group.links[0];
    if (group.kind === 'fan-in') {
      trunk = drawEnd({
        from: null,
        to: hubItem.to,
        fromFree: free,
        toRect: rectOf(hubItem, 'to', boxRects),
      }, boxRects, parentOf, ownerOf);
    } else {
      trunk = drawEnd({
        from: hubItem.from,
        to: null,
        fromRect: rectOf(hubItem, 'from', boxRects),
        toFree: free,
      }, boxRects, parentOf, ownerOf);
    }
    if (!trunk) return null;
    if (trunk.length < MIN_TRUNK() - W.ROUTE_EPSILON) return null;

    let cost = segmentCost(trunk);
    branches.forEach((entry) => { cost += segmentCost(entry.drawn); });
    return {
      junction: free,
      trunk,
      branches,
      cost,
      obstacles: obstacles || trunk.obstacles,
    };
  }

  function groupObstacles(group, boxRects, parentOf, ownerOf) {
    const ids = new Set();
    group.links.forEach((item) => {
      ids.add(item.from);
      ids.add(item.to);
    });
    const list = Array.from(ids);
    let obstacles = [];
    if (list.length >= 2) {
      obstacles = W.obstaclesFor(boxRects, parentOf, ownerOf, list[0], list[1]);
    }
    return obstacles;
  }

  function pickJunction(group, boxRects, parentOf, ownerOf) {
    const obstacles = groupObstacles(group, boxRects, parentOf, ownerOf);
    const candidates = candidatePoints(group, boxRects, obstacles);
    let best = null;
    candidates.forEach((pt) => {
      const trial = tryJunction(group, pt, boxRects, parentOf, ownerOf);
      if (!trial) return;
      if (!best || trial.cost < best.cost - W.ROUTE_EPSILON) best = trial;
    });
    return best;
  }

  function planTrunk(items, style, boxRects, parentOf, ownerOf) {
    const { groups, fallback } = groupLinks(items, style);
    const planned = [];
    const failed = [];
    groups.forEach((group) => {
      const picked = pickJunction(group, boxRects, parentOf, ownerOf);
      if (!picked) {
        failed.push.apply(failed, group.links);
        return;
      }
      planned.push({
        kind: group.kind,
        hub: group.hub,
        links: group.links,
        junction: picked.junction,
        trunk: picked.trunk,
        branches: picked.branches,
        obstacles: picked.obstacles,
      });
    });
    return {
      groups: planned,
      fallback: fallback.concat(failed),
    };
  }

  return {
    linkKey,
    groupLinks,
    candidatePoints,
    pickJunction,
    planTrunk,
    tryJunction,
    MIN_TRUNK,
  };
});
