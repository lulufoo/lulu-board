'use strict';

const Arrow = require('../../../../packages/board/engine/board-route/arrow');
const Choose = require('../../../../packages/board/engine/board-route/choose');
const Gates = require('../../../../packages/board/engine/board-route/gates');
const Route = require('../../../../packages/board/engine/board-route');

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const short1 = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
const mid1 = [{ x: 0, y: 0 }, { x: 30, y: 0 }];
const long1 = [{ x: 0, y: 0 }, { x: 40, y: 0 }];
const short2 = [{ x: 128, y: 18 }, { x: 796, y: 18 }, { x: 796, y: 22 }];
const long2 = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }];
const short3 = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 20 }, { x: 88, y: 20 }];
const wall = [{ left: 60, right: 70, top: 5, bottom: 15 }];

assert(Arrow.minArrowRun(short1) === Arrow.ARROW_MIN_RUN_1, 'k=1 min is 36');
assert(Arrow.minArrowRun(long2) === Arrow.ARROW_MIN_RUN, 'k=2 min stays 24');
assert(Arrow.slotNeed(short1) === Arrow.ARROW_MIN_RUN_1, '1-fold slot follows 36');
assert(Arrow.slotNeed(long2) === Arrow.ARROW_MIN_RUN, '2-fold slot stays 24');
assert(Arrow.slotNeed([]) === Arrow.ARROW_MIN_RUN, 'empty path slot stays 24');
assert(Arrow.slotNeed(short1, true) === Arrow.ARROW_MIN_RUN_1, 'both 1-fold slot stays 36');
assert(Arrow.slotNeed(long2, true) === Arrow.ARROW_MIN_RUN, 'both 2-fold slot stays 24');

// Default paint does not stretch — floor is ranked / slots grow.
const painted1 = Arrow.paintArrowRun(short1, []);
assert(Arrow.lastRunLength(painted1) === 10, 'k=1 short stays natural');
assert(Arrow.lastRunLength(Arrow.paintArrowRun(mid1, [])) === 30, 'k=1 of 30 stays');
assert(Arrow.lastRunLength(Arrow.paintArrowRun(long1, [])) === 40, 'k=1 already long stays');
const stretched1 = Arrow.paintArrowRun(short1, [], { enforceMin: true });
assert(Arrow.lastRunLength(stretched1) === Arrow.ARROW_MIN_RUN_1, 'enforceMin still stretches to 36');
assert(stretched1[0].x === 10 - Arrow.ARROW_MIN_RUN_1, 'enforceMin slides the start back');

assert(Arrow.realizeArrowRun(short2, [], null, { enforceMin: true }) == null, 'k=2 short cannot paint');
assert(Arrow.lastRunLength(Arrow.paintArrowRun(short2, [])) === 4, 'k=2 short keeps the 4px last run');
assert(Arrow.lastRunLength(Arrow.realizeArrowRun(long2, [], null, { enforceMin: true })) >= Arrow.ARROW_MIN_RUN, 'k=2 long last passes');

const realized3 = Arrow.realizeArrowRun(short3, [], null, { enforceMin: true });
assert(realized3, 'k=3 short last stretches when enforced');
assert(Arrow.lastRunLength(realized3) >= Arrow.ARROW_MIN_RUN, 'k=3 stretch reaches 24');
assert(Math.abs(realized3[realized3.length - 1].x - realized3[realized3.length - 2].x) === Arrow.ARROW_MIN_RUN
  && realized3[realized3.length - 1].y === realized3[realized3.length - 2].y, 'k=3 last stays orthogonal');

assert(Arrow.realizeArrowRun(short3, wall, null, { enforceMin: true }) == null, 'k=3 stretch that hits a box fails');
assert(Arrow.lastRunLength(Arrow.paintArrowRun(short3, wall)) < Arrow.ARROW_MIN_RUN, 'default paint keeps short last');

assert(Gates.veto({ points: short1 }, []) == null, 'k-select does not veto short 1-fold');
assert(Gates.veto({ points: short2 }, []) == null, 'k-select does not veto short 2-fold');
assert(Gates.veto({ points: short3 }, wall) == null, 'k-select does not veto unstretchable 3-fold');

const fromRect = { id: 'A', left: 0, right: 100, top: 0, bottom: 100 };
const toRect = { id: 'B', left: 400, right: 520, top: 20, bottom: 45 };
const mid = { id: 'M', left: 160, right: 300, top: 15, bottom: 190 };
const pack = Choose.packFor(
  { from: 'A', to: 'B', fromRect, toRect },
  new Map([['A', fromRect], ['B', toRect], ['M', mid]]),
  new Map([['A', null], ['B', null], ['M', null]]),
  new Map(),
);
// Flush 贴边 (clearance <= 3) is collision; clamped ~24-above paths stay walkable at k=2.
assert(pack && pack.k === 2, 'short-last 2-fold stays k=2 when not flush-stuck');
assert(pack.batch.some((c) => Arrow.lastRunLength(c.points) < Arrow.ARROW_MIN_RUN), 'k-select keeps short last runs');
assert(Gates.veto({ points: [{ x: 100, y: 8 }, { x: 400, y: 8 }, { x: 400, y: 32 }] }, pack.obstacles) == null,
  'short-last still not a k veto');

const paintedPack = Arrow.drawableBatch(pack.batch, pack.obstacles);
assert(paintedPack.length, 'drawing still has a k=2 batch');
assert(paintedPack.every((c) => c.folds === 2), 'drawing does not raise k');

const nearA = { id: 'NA', left: 0, right: 100, top: 0, bottom: 80 };
const nearB = { id: 'NB', left: 130, right: 230, top: 0, bottom: 80 };
const nearPack = Choose.packFor(
  { from: 'NA', to: 'NB', fromRect: nearA, toRect: nearB },
  new Map([['NA', nearA], ['NB', nearB]]),
  new Map([['NA', null], ['NB', null]]),
  new Map(),
);
assert(nearPack && nearPack.k === 1, 'aligned gap 30 stays k=1');
const nearPainted = Arrow.drawableBatch(nearPack.batch, nearPack.obstacles);
assert(nearPainted.every((c) => c.folds === 1), 'k=1 drawing stays 1-fold');
assert(nearPainted.some((c) => Arrow.lastRunLength(c.points) < Arrow.ARROW_MIN_RUN_1), 'k=1 floor not paint-stretched');

const farB = { id: 'FB', left: 140, right: 240, top: 0, bottom: 80 };
const farPack = Choose.packFor(
  { from: 'NA', to: 'FB', fromRect: nearA, toRect: farB },
  new Map([['NA', nearA], ['FB', farB]]),
  new Map([['NA', null], ['FB', null]]),
  new Map(),
);
assert(farPack && farPack.k === 1, 'aligned gap 40 stays k=1');

const stackGate = {
  id: 'GATE', kind: 'diamond',
  left: 322, right: 478, top: 207, bottom: 318,
  x: 400, y: 262.5, width: 156, height: 111,
};
const stackBot = { id: 'BOT', left: 299, right: 501, top: 342, bottom: 524 };
const stackPlane = { id: 'PLANE', left: 268, right: 532, top: 58, bottom: 540 };
const stackPack = Choose.packFor(
  { from: 'BOT', to: 'GATE', fromRect: stackBot, toRect: stackGate },
  new Map([['GATE', stackGate], ['BOT', stackBot], ['PLANE', stackPlane]]),
  new Map([['GATE', 'PLANE'], ['BOT', 'PLANE'], ['PLANE', null]]),
  new Map(),
);
assert(stackPack && stackPack.k === 1, '24-gap stack stays 1-fold');
const stackPainted = Arrow.drawableBatch(stackPack.batch, stackPack.obstacles);
assert(stackPainted.every((c) => c.folds === 1), '24-gap drawing stays 1-fold');
assert(stackPainted.every((c) => Arrow.lastRunLength(c.points) === 24), '24-gap stays natural floor short');

const routed = Route.route({
  style: 'trunk',
  boxRects: new Map([['GATE', stackGate], ['BOT', stackBot], ['PLANE', stackPlane]]),
  views: [{ id: 'PLANE', boxes: [{ id: 'GATE' }, { id: 'BOT' }] }],
  links: [{
    from: 'BOT',
    to: 'GATE',
    fromRect: stackBot,
    toRect: stackGate,
    title: '提出动作',
  }],
});
assert(routed[0] && routed[0].points && routed[0].points.length === 2, 'route keeps 1-fold');
assert(Arrow.lastRunLength(routed[0].points) === 24, 'route keeps natural 24 (floor via rank/slots)');

console.log('ok arrow-realize');
