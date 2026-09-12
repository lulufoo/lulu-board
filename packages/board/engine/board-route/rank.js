/* BoardRoute rank: lex table for pickCandidate. List order is priority. */
(function (root, factory) {
  const World = root.BoardRouteWorld || (typeof require === 'function' ? require('./world') : null);
  if (!World) throw new Error('BoardRouteWorld is not loaded');
  const api = factory(World);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardRouteRank = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (W) {
  'use strict';

  const apart = (a, b) => Math.abs(a - b) > W.ROUTE_EPSILON;
  const higherWins = (left, right) => (left > right ? -1 : 1);
  const lowerWins = (left, right) => (left < right ? -1 : 1);

  const relationVector = (fromRect, toRect) => W.sideVector(W.facingSide(fromRect, toRect));

  function facingScore(candidate, ctx) {
    const fromRect = ctx.fromRect;
    const toRect = ctx.toRect;
    if (!fromRect || !toRect || !candidate || !candidate.source || !candidate.target) return 0;
    const rel = relationVector(fromRect, toRect);
    const leave = W.sideVector(candidate.source.side);
    const arrive = W.sideVector(W.OPPOSITE_SIDE[candidate.target.side]);
    let score = 0;
    if (candidate.source.side === W.facingSide(fromRect, toRect)) score += 4;
    if (candidate.target.side === W.facingSide(toRect, fromRect)) score += 4;
    if (leave.x * rel.x + leave.y * rel.y > 0.25) score += 2;
    if (arrive.x * rel.x + arrive.y * rel.y > 0.25) score += 2;
    return score;
  }

  const facing = {
    key: 'facing',
    score: facingScore,
    cmp: (a, b) => (apart(a.facing, b.facing) ? higherWins(a.facing, b.facing) : 0),
  };

  // Trunk no longer rewards overlap; Plan creates shared trunks.
  const trunk = {
    key: 'bundle',
    score: () => 0,
    cmp: () => 0,
  };

  const stagger = {
    key: 'bundle',
    score: (candidate, ctx) => W.parallelClearance(candidate.points, ctx.occupied),
    cmp: (a, b) => {
      const aOk = a.bundle >= W.ROUTE_GAP;
      const bOk = b.bundle >= W.ROUTE_GAP;
      if (aOk !== bOk) return aOk ? -1 : 1;
      if (aOk || !apart(a.bundle, b.bundle)) return 0;
      return higherWins(a.bundle, b.bundle);
    },
  };

  const space = {
    key: 'space',
    score: (candidate, ctx) => W.pathBoxClearance(candidate.points, ctx.obstacles),
    cmp: (a, b) => {
      const aOk = a.space >= W.ROUTE_GAP;
      const bOk = b.space >= W.ROUTE_GAP;
      if (aOk !== bOk) return aOk ? -1 : 1;
      if (aOk || !apart(a.space, b.space)) return 0;
      return higherWins(a.space, b.space);
    },
  };

  // After space (≥24 ties): k=1 → max(biasA,biasB) (equal-distance mid);
  // k>1 → each end its own bias (sum).
  const center = {
    key: 'center',
    score: (candidate) => W.geometricCenterBias(candidate),
    cmp: (a, b) => (apart(a.center, b.center) ? lowerWins(a.center, b.center) : 0),
  };


  const length = {
    key: 'length',
    score: (candidate) => candidate.length,
    cmp: (a, b) => (apart(a.length, b.length) ? lowerWins(a.length, b.length) : 0),
  };

  const order = {
    key: 'order',
    score: (_candidate, ctx) => ctx.order,
    cmp: (a, b) => a.order - b.order,
  };

  function tableBetween() {
    return [facing];
  }

  function tableWithin(preference) {
    return [
      preference === 'stagger' ? stagger : trunk,
      space,
      center,
      length,
      order,
    ];
  }

  function table(preference) {
    return tableBetween().concat(tableWithin(preference));
  }

  function foldKey(candidate) {
    const src = (candidate && candidate.source && candidate.source.side) || '';
    const tgt = (candidate && candidate.target && candidate.target.side) || '';
    const points = (candidate && candidate.points) || [];
    let rail = '';
    if (points.length >= 4) {
      const a = points[1];
      const b = points[2];
      if (a && b) {
        if (Math.abs(a.y - b.y) < W.ROUTE_EPSILON) rail = ':h';
        else if (Math.abs(a.x - b.x) < W.ROUTE_EPSILON) rail = ':v';
      }
    }
    return src + '>' + tgt + rail;
  }

  function listWalkable(batch) {
    const k = minFolds(batch);
    const out = [];
    (batch || []).forEach((candidate, order) => {
      if (candidate && candidate.folds === k) out.push({ candidate, order });
    });
    return out;
  }

  function groupByFold(rows) {
    const groups = new Map();
    (rows || []).forEach((row) => {
      const key = row.fold || foldKey(row);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return Array.from(groups.values());
  }

  function pickFrom(rows, ranks) {
    let selected = null;
    (rows || []).forEach((row) => {
      if (!selected || before(row, selected, ranks)) selected = row;
    });
    return selected;
  }

  function minFolds(batch) {
    let k = Infinity;
    (batch || []).forEach((candidate) => {
      if (candidate && candidate.folds < k) k = candidate.folds;
    });
    return k;
  }

  function scoreRow(candidate, orderIndex, ctx, ranks) {
    const row = {
      source: candidate.source,
      target: candidate.target,
      points: candidate.points,
      folds: candidate.folds,
      fold: foldKey(candidate),
    };
    const scoreCtx = {
      occupied: ctx.occupied,
      fromRect: ctx.fromRect,
      toRect: ctx.toRect,
      obstacles: ctx.obstacles,
      order: orderIndex,
    };
    (ranks || []).forEach((rank) => {
      row[rank.key] = rank.score(candidate, scoreCtx);
    });
    return row;
  }

  function before(a, b, ranks) {
    for (let index = 0; index < ranks.length; index += 1) {
      const delta = ranks[index].cmp(a, b);
      if (delta) return delta < 0;
    }
    return false;
  }

  return {
    table,
    tableBetween,
    tableWithin,
    foldKey,
    listWalkable,
    groupByFold,
    pickFrom,
    minFolds,
    scoreRow,
    before,
  };
});
