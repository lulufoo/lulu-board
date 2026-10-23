/* BoardRoute search: enumerate legal 1/2/3-fold paths only. No facing filter. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  if (!World) throw new Error('BoardRouteWorld is not loaded');
  const api = factory(World);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteSearch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W) {
  'use strict';

  function enumerateFolds(folds, sourcePorts, targetPorts, obstacles) {
    const batch = [];
    if (folds === 1) {
      sourcePorts.forEach((source) => {
        targetPorts.forEach((target) => {
          const aligned = Math.abs(source.point.x - target.point.x) < W.ROUTE_EPSILON
            || Math.abs(source.point.y - target.point.y) < W.ROUTE_EPSILON;
          if (!aligned) return;
          const found = W.acceptCandidate(source, target, [source.point, target.point], obstacles, 1);
          if (found) batch.push(found);
        });
      });
      return batch;
    }
    if (folds === 2) {
      sourcePorts.forEach((source) => {
        targetPorts.forEach((target) => {
          [
            W.point(target.point.x, source.point.y),
            W.point(source.point.x, target.point.y),
          ].forEach((corner) => {
            if (W.samePoint(corner, source.point) || W.samePoint(corner, target.point)) return;
            const found = W.acceptCandidate(source, target, [source.point, corner, target.point], obstacles, 2);
            if (found) batch.push(found);
          });
        });
      });
      return batch;
    }
    if (folds !== 3) return batch;
    // Morphology is 3-fold; rail x/y come only from this link's corridor
    // (endpoint ports + obstacles that intersect that corridor). Full
    // `obstacles` still gate acceptCandidate / pathHits.
    const portPoints = sourcePorts.map((entry) => entry.point).concat(targetPorts.map((entry) => entry.point));
    const xs = W.foldRailCoordinates(portPoints, obstacles, 'x');
    const ys = W.foldRailCoordinates(portPoints, obstacles, 'y');
    sourcePorts.forEach((source) => {
      targetPorts.forEach((target) => {
        xs.forEach((railX) => {
          if (Math.abs(railX - source.point.x) < W.ROUTE_EPSILON || Math.abs(railX - target.point.x) < W.ROUTE_EPSILON) return;
          const found = W.acceptCandidate(
            source,
            target,
            [source.point, W.point(railX, source.point.y), W.point(railX, target.point.y), target.point],
            obstacles,
            3,
          );
          if (found) batch.push(found);
        });
        ys.forEach((railY) => {
          if (Math.abs(railY - source.point.y) < W.ROUTE_EPSILON || Math.abs(railY - target.point.y) < W.ROUTE_EPSILON) return;
          const found = W.acceptCandidate(
            source,
            target,
            [source.point, W.point(source.point.x, railY), W.point(target.point.x, railY), target.point],
            obstacles,
            3,
          );
          if (found) batch.push(found);
        });
      });
    });
    return batch;
  }

  return { enumerateFolds };
});
