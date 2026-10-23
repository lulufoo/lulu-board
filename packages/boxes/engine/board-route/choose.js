/* BoardRoute choose: packFor picks k; pickCandidate lists folds, picks within, then between. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  const Search = root.BoardRouteSearch || (typeof require === 'function' ? require('./search') : null);
  const Fallback = root.BoardRouteFallback || (typeof require === 'function' ? require('./fallback') : null);
  const Gates = root.BoardRouteGates || (typeof require === 'function' ? require('./gates') : null);
  const Rank = root.BoardRouteRank || (typeof require === 'function' ? require('./rank') : null);
  if (!World || !Search || !Fallback || !Gates || !Rank) throw new Error('BoardRoute choose deps are not loaded');
  const api = factory(World, Search, Fallback, Gates, Rank);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteChoose = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W, Search, Fallback, Gates, Rank) {
  'use strict';

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

  function packFor(item, boxRects, parentOf, ownerOf) {
    if (!item) return null;
    const fromFree = item.fromFree;
    const toFree = item.toFree;
    const hasFromBox = item.from != null && item.fromRect;
    const hasToBox = item.to != null && item.toRect;
    if (!fromFree && !hasFromBox) return null;
    if (!toFree && !hasToBox) return null;
    if (!fromFree && !toFree && item.from === item.to) return null;

    const fromId = fromFree ? null : item.from;
    const toId = toFree ? null : item.to;
    const obstacles = item.obstacles
      || W.obstaclesFor(boxRects, parentOf, ownerOf, fromId, toId);

    const mateForFrom = toFree ? freeMate(toFree.point) : item.toRect;
    const mateForTo = fromFree ? freeMate(fromFree.point) : item.fromRect;
    const sourcePorts = fromFree
      ? W.freePorts(fromFree.point, fromFree.dirs)
      : W.attachmentPorts(item.fromRect, mateForFrom, obstacles);
    const targetPorts = toFree
      ? W.freePorts(toFree.point, toFree.dirs)
      : W.attachmentPorts(item.toRect, mateForTo, obstacles);
    if (!sourcePorts.length || !targetPorts.length) return null;

    // Layer 1 — smallest k whose walkable batch is non-empty.
    for (let folds = 1; folds <= 3; folds += 1) {
      const enumerated = Search.enumerateFolds(folds, sourcePorts, targetPorts, obstacles);
      const batch = Gates.admitBatch(enumerated, obstacles);
      if (batch.length) return { k: folds, batch, obstacles };
    }

    // Layer 1 fallback — only when 1..3 are empty.
    let leadS = sourcePorts;
    let leadT = targetPorts;
    if (!fromFree && item.fromRect && mateForFrom) {
      const face = W.facingSide(item.fromRect, mateForFrom);
      const filtered = sourcePorts.filter((port) => port.side === face);
      if (filtered.length) leadS = filtered;
    }
    if (!toFree && item.toRect && mateForTo) {
      const face = W.facingSide(item.toRect, mateForTo);
      const filtered = targetPorts.filter((port) => port.side === face);
      if (filtered.length) leadT = filtered;
    }
    const leads = Gates.admitBatch(Fallback.enumerateLeadRails(leadS, leadT, obstacles), obstacles);
    if (leads.length) {
      return { k: leads.reduce((min, candidate) => Math.min(min, candidate.folds), leads[0].folds), batch: leads, obstacles };
    }
    const grid = Fallback.gridFallback(leadS, leadT, obstacles);
    if (!grid || !grid.batch || !grid.batch.length) return null;
    const gridBatch = Gates.admitBatch(grid.batch, obstacles);
    return gridBatch.length ? { k: grid.k, batch: gridBatch, obstacles } : null;
  }

  function pickCandidate(batch, occupied, preference, fromRect, toRect, obstacles) {
    const listed = Rank.listWalkable(batch);
    if (!listed.length) return null;
    const ctx = { occupied, fromRect, toRect, obstacles };
    const rows = listed.map((entry) => Rank.scoreRow(entry.candidate, entry.order, ctx, Rank.table(preference)));
    const groups = Rank.groupByFold(rows);
    const within = Rank.tableWithin(preference);
    const winners = groups.map((group) => Rank.pickFrom(group, within));
    return Rank.pickFrom(winners, Rank.tableBetween().concat(within));
  }

  return { packFor, pickCandidate };
});
