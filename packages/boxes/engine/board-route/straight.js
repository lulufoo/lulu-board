/* BoardRoute straight: one segment, center ray clipped to borders. No dodge. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  if (!World) throw new Error('BoardRouteWorld is not loaded');
  const api = factory(World);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteStraight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W) {
  'use strict';

  function centerOf(rect) {
    return {
      x: Number.isFinite(rect.x) ? rect.x : (rect.left + rect.right) / 2,
      y: Number.isFinite(rect.y) ? rect.y : (rect.top + rect.bottom) / 2,
    };
  }

  function boxSize(rect) {
    return {
      w: Number.isFinite(rect.width) ? rect.width : rect.right - rect.left,
      h: Number.isFinite(rect.height) ? rect.height : rect.bottom - rect.top,
    };
  }

  function hitSide(rect, pt) {
    const mid = centerOf(rect);
    const dx = pt.x - mid.x;
    const dy = pt.y - mid.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
    return dy >= 0 ? 'bottom' : 'top';
  }

  function clipBox(rect, ox, oy, dx, dy) {
    let t = Infinity;
    if (dx > W.ROUTE_EPSILON) t = Math.min(t, (rect.right - ox) / dx);
    else if (dx < -W.ROUTE_EPSILON) t = Math.min(t, (rect.left - ox) / dx);
    if (dy > W.ROUTE_EPSILON) t = Math.min(t, (rect.bottom - oy) / dy);
    else if (dy < -W.ROUTE_EPSILON) t = Math.min(t, (rect.top - oy) / dy);
    if (!Number.isFinite(t) || t < 0) return null;
    return { t, point: W.point(ox + dx * t, oy + dy * t) };
  }

  function clipDiamond(rect, ox, oy, dx, dy) {
    const size = boxSize(rect);
    const hw = size.w / 2;
    const hh = size.h / 2;
    if (!(hw > W.ROUTE_EPSILON) || !(hh > W.ROUTE_EPSILON)) return clipBox(rect, ox, oy, dx, dy);
    const denom = Math.abs(dx) / hw + Math.abs(dy) / hh;
    if (denom <= W.ROUTE_EPSILON) return null;
    const t = 1 / denom;
    return { t, point: W.point(ox + dx * t, oy + dy * t) };
  }

  function clipExit(rect, ox, oy, dx, dy) {
    if (rect && rect.kind === 'diamond') return clipDiamond(rect, ox, oy, dx, dy);
    return clipBox(rect, ox, oy, dx, dy);
  }

  function clip(fromRect, toRect) {
    if (!fromRect || !toRect) return null;
    const a = centerOf(fromRect);
    const b = centerOf(toRect);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < W.ROUTE_EPSILON && Math.abs(dy) < W.ROUTE_EPSILON) return null;
    const leave = clipExit(fromRect, a.x, a.y, dx, dy);
    const enter = clipExit(toRect, b.x, b.y, -dx, -dy);
    if (!leave || !enter) return null;
    return {
      from: leave.point,
      to: enter.point,
      fromSide: hitSide(fromRect, leave.point),
      toSide: hitSide(toRect, enter.point),
    };
  }

  function apply(item) {
    if (!item) return false;
    const found = clip(item.fromRect, item.toRect);
    if (!found) return false;
    item.points = [found.from, found.to];
    item.d = W.routePath(item.points);
    const label = W.routeLabel(item.points);
    item.labelX = label.x;
    item.labelY = label.y;
    item.fromSide = found.fromSide;
    item.toSide = found.toSide;
    return true;
  }

  return { clip, apply };
});
