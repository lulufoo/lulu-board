/* BoardRoute arrow: last-run min is drawing after k is picked. Must not change k. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  if (!World) throw new Error('BoardRouteWorld is not loaded');
  const api = factory(World);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteArrow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W) {
  'use strict';

  const ARROW_MIN_RUN = 24;
  const ARROW_MIN_RUN_1 = 36;

  function minArrowRun(points) {
    return points && points.length === 2 ? ARROW_MIN_RUN_1 : ARROW_MIN_RUN;
  }

  function lastRunLength(points) {
    if (!points || points.length < 2) return 0;
    const from = points[points.length - 2];
    const to = points[points.length - 1];
    return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  }

  function isOrthogonal(points) {
    if (!points || points.length < 2) return false;
    for (let index = 1; index < points.length; index += 1) {
      if (!W.routeDirection(points[index - 1], points[index])) return false;
    }
    return true;
  }

  function copyPoints(points) {
    return points.map((entry) => W.point(entry.x, entry.y));
  }

  // 1-fold: end stays on the target port; start slides back along the run.
  function extendStart(points, need) {
    const next = copyPoints(points);
    const start = next[0];
    const end = next[next.length - 1];
    const head = W.routeDirection(start, end);
    if (head === 'right') start.x = end.x - need;
    else if (head === 'left') start.x = end.x + need;
    else if (head === 'bottom') start.y = end.y - need;
    else if (head === 'top') start.y = end.y + need;
    else return points;
    return next;
  }

  // 3-fold: move the last rail so the last run reaches need. Keep H/V.
  function stretchLastRail(points, need) {
    const next = copyPoints(points);
    const from = next[next.length - 2];
    const to = next[next.length - 1];
    const head = W.routeDirection(from, to);
    const rail = next.length > 3 ? next[next.length - 3] : null;
    if (!head || !rail) return null;
    if (head === 'right') {
      from.x = to.x - need;
      rail.x = from.x;
    } else if (head === 'left') {
      from.x = to.x + need;
      rail.x = from.x;
    } else if (head === 'bottom') {
      from.y = to.y - need;
      rail.y = from.y;
    } else {
      from.y = to.y + need;
      rail.y = from.y;
    }
    const simplified = W.simplifyRoute(next);
    if (!isOrthogonal(simplified) || lastRunLength(simplified) < need) return null;
    return simplified;
  }

  function enforceMinFrom(opts) {
    // Default false: min run is a floor (rank / grow slots), not paint stretch.
    // Pass enforceMin:true only when a caller explicitly wants stretch.
    if (!opts || opts.enforceMin == null) return false;
    return !!opts.enforceMin;
  }

  // Drawing keeps geometry by default. Arrow min (24/36) is an in-box floor
  // (sibling slots grow via slotNeed). Outside a box, layout owns the gap —
  // never paint-stretch. opts.enforceMin:true is opt-in stretch for tests.

  function paintArrowRun(points, obstacles, opts) {
    if (!points || points.length < 2 || !isOrthogonal(points)) return points;
    if (!enforceMinFrom(opts)) return points;
    const need = minArrowRun(points);
    if (lastRunLength(points) >= need) return points;
    if (points.length === 2) return extendStart(points, need);
    if (points.length === 3) return points;
    const stretched = stretchLastRail(points, need);
    if (!stretched) return points;
    if (obstacles && W.pathHits(stretched, obstacles, stretched.length - 1)) return points;
    return stretched;
  }

  function ensureArrowRun(points) {
    return paintArrowRun(points, null);
  }

  function realizeArrowRun(points, obstacles, minRun, opts) {
    if (!points || points.length < 2 || !isOrthogonal(points)) return null;
    const enforce = enforceMinFrom(opts);
    const need = Number.isFinite(minRun) ? minRun : (enforce ? minArrowRun(points) : 0);
    if (need <= 0 || lastRunLength(points) >= need) return points;
    const painted = paintArrowRun(points, obstacles, opts);
    if (!isOrthogonal(painted) || lastRunLength(painted) < need) return null;
    return painted;
  }

  function slotNeed(points, both) {
    // Sibling slots are always inside a box — min length stays on.
    if (!points || points.length < 2) return ARROW_MIN_RUN;
    const last = minArrowRun(points);
    if (!both) return last;
    const first = points.length === 2 ? ARROW_MIN_RUN_1 : ARROW_MIN_RUN;
    return Math.max(last, first);
  }

  function drawableBatch(batch, obstacles, opts) {
    // Floor is ranked later; do not stretch or drop short last-runs here.
    const painted = [];
    (batch || []).forEach((candidate) => {
      const points = paintArrowRun(candidate.points, obstacles, opts);
      painted.push({
        source: candidate.source,
        target: candidate.target,
        points,
        folds: points.length - 1,
        length: W.pathLength(points),
      });
    });
    return painted;
  }

  return {
    ensureArrowRun,
    paintArrowRun,
    realizeArrowRun,
    drawableBatch,
    slotNeed,
    lastRunLength,
    minArrowRun,
    ARROW_MIN_RUN,
    ARROW_MIN_RUN_1,
  };
});
