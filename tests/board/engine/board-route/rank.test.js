'use strict';

const Rank = require('../../../../packages/board/engine/board-route/rank');
const World = require('../../../../packages/board/engine/board-route/world');

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const trunkKeys = Rank.table('trunk').map((rank) => rank.key);
const staggerKeys = Rank.table('stagger').map((rank) => rank.key);
assert(trunkKeys.join() === 'facing,bundle,space,center,length,order', 'trunk table is facing then within');
assert(staggerKeys.join() === 'facing,bundle,space,center,length,order', 'stagger table is facing then within');
assert(Rank.table('trunk')[1] !== Rank.table('stagger')[1], 'item 2 is trunk or stagger');

const ranks = Rank.table('stagger');
assert(ranks[1].cmp({ bundle: 30 }, { bundle: 40 }) === 0, 'both ≥24 stagger ties');
assert(ranks[1].cmp({ bundle: 10 }, { bundle: 8 }) < 0, 'both short: farther stagger wins');
assert(ranks[1].cmp({ bundle: 30 }, { bundle: 10 }) < 0, 'clear stagger beats short');

const mixed = [{ folds: 3, length: 1 }, { folds: 2, length: 9 }, { folds: 2, length: 4 }];
assert(Rank.minFolds(mixed) === 2, 'minFolds skips the 3-fold');

const facing = Rank.table('trunk')[0];
assert(facing.cmp({ facing: 8 }, { facing: 4 }) < 0, 'higher facing wins');
assert(Rank.table('trunk')[2].cmp({ space: 30 }, { space: 40 }) === 0, 'both ≥24 box gap ties');
assert(Rank.table('trunk')[2].cmp({ space: 10 }, { space: 8 }) < 0, 'both short: larger box gap wins');
assert(Rank.table('trunk')[2].cmp({ space: 30 }, { space: 10 }) < 0, 'box gap ≥24 beats short');
assert(Rank.table('trunk')[3].cmp({ center: 1 }, { center: 8 }) < 0, 'closer side center wins');
assert(Rank.table('trunk')[4].cmp({ length: 10 }, { length: 20 }) < 0, 'shorter wins');
assert(Rank.table('trunk')[5].cmp({ order: 0 }, { order: 3 }) < 0, 'earlier wins');

assert(Rank.before({ facing: 8, bundle: 0, space: 0, center: 9, length: 99, order: 9 }, { facing: 4, bundle: 80, space: 40, center: 0, length: 1, order: 0 }, Rank.table('trunk')), 'item 1 beats later keys');

assert(Rank.tableBetween().map((rank) => rank.key).join() === 'facing', 'between is facing');
assert(Rank.tableWithin('trunk').map((rank) => rank.key).join() === 'bundle,space,center,length,order', 'within is how to draw');

const rightTop = {
  source: { side: 'right' },
  target: { side: 'top' },
  folds: 2,
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }],
};
const rightTopAlt = {
  source: { side: 'right' },
  target: { side: 'top' },
  folds: 2,
  points: [{ x: 0, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 8 }],
};
const bottomLeft = {
  source: { side: 'bottom' },
  target: { side: 'left' },
  folds: 2,
  points: [{ x: 0, y: 0 }, { x: 0, y: 8 }, { x: 10, y: 8 }],
};
assert(Rank.foldKey(rightTop) === 'right>top', 'k=2 key is sides');
assert(Rank.foldKey({
  source: { side: 'right' },
  target: { side: 'top' },
  points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 8 }, { x: 10, y: 8 }],
}) === 'right>top:v', 'k=3 vertical rail is its own fold');
assert(Rank.listWalkable([bottomLeft, { folds: 3, source: { side: 'right' }, target: { side: 'top' } }]).length === 1, 'walkable keeps the smallest k');

const grouped = Rank.groupByFold([
  { fold: Rank.foldKey(rightTop) },
  { fold: Rank.foldKey(rightTopAlt) },
  { fold: Rank.foldKey(bottomLeft) },
]);
assert(grouped.length === 2, 'two fold methods');
assert(grouped.some((group) => group.length === 2) && grouped.some((group) => group.length === 1), 'same fold stays together');

console.log('ok rank');

// Center: k=1 → max(biasA,biasB); k>1 → each end its own bias (sum).
assert(World.geometricCenterBias({ folds: 1, source: { bias: 5 }, target: { bias: 5 } }) === 5, 'k=1 equal distances score max');
assert(World.geometricCenterBias({ folds: 1, source: { bias: 0 }, target: { bias: 10 } }) === 10, 'k=1 one-sided scores worse');
assert(
  World.geometricCenterBias({ folds: 1, source: { bias: 5 }, target: { bias: 5 } })
    < World.geometricCenterBias({ folds: 1, source: { bias: 0 }, target: { bias: 10 } }),
  'same L1 sum: balanced beats one-sided',
);
assert(World.geometricCenterBias({ folds: 2, source: { bias: 3 }, target: { bias: 5 } }) === 8, 'k=2 sums own biases');
assert(World.geometricCenterBias({ folds: 3, source: { bias: 9 }, target: { bias: 1 } }) === 10, 'k=3 sums own biases');
assert(
  World.geometricCenterBias({ folds: 2, source: { bias: 0 }, target: { bias: 0 } })
    < World.geometricCenterBias({ folds: 2, source: { bias: 4 }, target: { bias: 0 } }),
  'k>1: closer own mid still wins',
);
