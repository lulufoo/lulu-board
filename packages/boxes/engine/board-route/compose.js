/* BoardRoute compose: stitch branch+trunk polylines back onto original links. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  if (!World) throw new Error('BoardRouteWorld is not loaded');
  const api = factory(World);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteCompose = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W) {
  'use strict';

  function compact(points) {
    const out = [];
    (points || []).forEach((pt) => {
      if (!out.length || !W.samePoint(out[out.length - 1], pt)) out.push(pt);
    });
    return out;
  }

  function stitch(head, tail) {
    if (!head || !head.length) return compact(tail);
    if (!tail || !tail.length) return compact(head);
    const out = head.slice();
    const start = W.samePoint(out[out.length - 1], tail[0]) ? 1 : 0;
    for (let index = start; index < tail.length; index += 1) out.push(tail[index]);
    // Dedupe the join only — keep a colinear Junction vertex so the trunk
    // endpoint stays visible on every composed link.
    return compact(out);
  }

  // Fan-in: leaf→J branch + J→hub trunk. Fan-out: hub→J trunk + J→leaf branch.
  function mergeSegments(kind, branch, trunk) {
    if (!branch || !trunk || !branch.points || !trunk.points) return null;
    const points = kind === 'fan-out'
      ? stitch(trunk.points, branch.points)
      : stitch(branch.points, trunk.points);
    if (!points || points.length < 2) return null;
    const fromSide = kind === 'fan-out'
      ? (trunk.source && trunk.source.side)
      : (branch.source && branch.source.side);
    const toSide = kind === 'fan-out'
      ? (branch.target && branch.target.side)
      : (trunk.target && trunk.target.side);
    return { points, fromSide, toSide };
  }

  function applyToLink(item, merged, paintArrow, obstacles) {
    if (!item || !merged || !merged.points) return false;
    const painted = paintArrow ? paintArrow(merged.points, obstacles) : merged.points;
    item.points = painted;
    item.d = W.routePath(painted);
    const label = W.routeLabel(painted);
    item.labelX = label.x;
    item.labelY = label.y;
    if (merged.fromSide) item.fromSide = merged.fromSide;
    if (merged.toSide) item.toSide = merged.toSide;
    return true;
  }

  return { stitch, mergeSegments, applyToLink };
});
