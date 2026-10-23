/* BoardRoute label: along-path place. Zero-hit span center, else min area. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  if (!World) throw new Error('BoardRouteWorld is not loaded');
  const api = factory(World);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteLabel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W) {
  'use strict';

  const H_PAD = 7;
  const V_PAD = 6;
  const SHORT_SIDE_PAD = 16;
  const SHORT_RUN = 40;
  const AREA_EPS = 1;
  const STEP_PX = 4;
  const EDGE_T = 0.1;

  function intersectArea(a, b) {
    if (!a || !b) return 0;
    const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (width <= 0 || height <= 0) return 0;
    return width * height;
  }

  function overlapArea(box, obstacles) {
    let total = 0;
    (obstacles || []).forEach((obstacle) => {
      total += intersectArea(box, obstacle);
    });
    return total;
  }

  function labelBox(x, y, metrics) {
    return {
      left: x + metrics.dx,
      top: y + metrics.dy,
      right: x + metrics.dx + metrics.width,
      bottom: y + metrics.dy + metrics.height,
    };
  }

  function padsFor(dir, segLen) {
    const short = Number.isFinite(segLen) && segLen < SHORT_RUN;
    if (dir === 'left' || dir === 'right') {
      const pad = short ? SHORT_SIDE_PAD : H_PAD;
      return [{ x: 0, y: -pad }, { x: 0, y: pad }];
    }
    const pad = short ? SHORT_SIDE_PAD : V_PAD;
    return [{ x: pad, y: 0 }, { x: -pad, y: 0 }];
  }

  function better(a, b) {
    const aZero = a.overlap <= AREA_EPS;
    const bZero = b.overlap <= AREA_EPS;
    if (aZero !== bZero) return aZero;
    if (aZero && bZero) {
      if (Math.abs(a.runLen - b.runLen) > W.ROUTE_EPSILON) return a.runLen > b.runLen;
      if (Math.abs(a.segLen - b.segLen) > W.ROUTE_EPSILON) return a.segLen > b.segLen;
      if (a.padIndex !== b.padIndex) return a.padIndex < b.padIndex;
      return a.order < b.order;
    }
    if (Math.abs(a.overlap - b.overlap) > AREA_EPS) return a.overlap < b.overlap;
    // Short gaps: keep label near segment mid so it stays between the two boxes.
    const aMid = Math.abs((a.t == null ? 0.5 : a.t) - 0.5);
    const bMid = Math.abs((b.t == null ? 0.5 : b.t) - 0.5);
    if (Math.abs(aMid - bMid) > 0.02) return aMid < bMid;
    if (Math.abs(a.segLen - b.segLen) > W.ROUTE_EPSILON) return a.segLen > b.segLen;
    return a.order < b.order;
  }

  function sampleSide(from, to, pad, padIndex, metrics, obstacles, orderBase) {
    const segLen = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    const steps = Math.max(4, Math.round(segLen / STEP_PX));
    const hits = [];
    for (let index = 0; index <= steps; index += 1) {
      const t = EDGE_T + (1 - 2 * EDGE_T) * (index / steps);
      const x = from.x + (to.x - from.x) * t + pad.x;
      const y = from.y + (to.y - from.y) * t + pad.y;
      const box = labelBox(x, y, metrics);
      hits.push({ t, x, y, box, overlap: overlapArea(box, obstacles), segLen, padIndex });
    }
    const out = [];
    let index = 0;
    while (index < hits.length) {
      if (hits[index].overlap > AREA_EPS) {
        index += 1;
        continue;
      }
      let end = index;
      while (end + 1 < hits.length && hits[end + 1].overlap <= AREA_EPS) end += 1;
      const tMid = (hits[index].t + hits[end].t) / 2;
      const x = from.x + (to.x - from.x) * tMid + pad.x;
      const y = from.y + (to.y - from.y) * tMid + pad.y;
      out.push({
        x,
        y,
        t: tMid,
        box: labelBox(x, y, metrics),
        overlap: 0,
        segLen,
        runLen: Math.abs(hits[end].t - hits[index].t) * segLen,
        padIndex,
        order: orderBase + out.length,
      });
      index = end + 1;
    }
    if (!out.length) {
      let worst = hits[0];
      hits.forEach((entry) => {
        if (entry.overlap < worst.overlap) worst = entry;
      });
      if (worst) {
        out.push({
          x: worst.x,
          y: worst.y,
          t: worst.t,
          box: worst.box,
          overlap: worst.overlap,
          segLen,
          runLen: 0,
          padIndex,
          order: orderBase,
        });
      }
    }
    return out;
  }

  function candidates(points, metrics, obstacles) {
    const out = [];
    if (!points || points.length < 2 || !metrics) return out;
    let order = 0;
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      const dir = W.routeDirection(from, to);
      if (!dir) continue;
      const segLen = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      padsFor(dir, segLen).forEach((pad, padIndex) => {
        const found = sampleSide(from, to, pad, padIndex, metrics, obstacles || [], order);
        found.forEach((entry) => out.push(entry));
        order += found.length || 1;
      });
    }
    return out;
  }

  function place(points, metrics, obstacles) {
    const list = candidates(points, metrics, obstacles);
    if (!list.length) {
      const fallback = W.routeLabel(points);
      return { x: fallback.x, y: fallback.y, box: null, overlap: 0 };
    }
    let selected = null;
    list.forEach((entry) => {
      if (!selected || better(entry, selected)) selected = entry;
    });
    return selected;
  }

  return { place, candidates, overlapArea, intersectArea };
});
