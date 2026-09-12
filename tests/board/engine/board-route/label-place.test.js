'use strict';

const Label = require('../../../../packages/board/engine/board-route/label');

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const metrics = { dx: -50, dy: -12, width: 100, height: 16 };
const points = [{ x: 0, y: 40 }, { x: 400, y: 40 }];

const open = Label.place(points, metrics, []);
assert(open.overlap <= 1, 'open corridor is zero-hit');
assert(Math.abs(open.x - 200) < 8, 'open corridor sits near the free-span center');
assert(open.y === 33, 'prefers the above offset');

const leftWall = [{ left: 0, right: 160, top: 20, bottom: 60 }];
const shifted = Label.place(points, metrics, leftWall);
assert(shifted.overlap <= 1, 'blocked left stays zero-hit on the remaining span');
assert(shifted.x > 250 && shifted.x < 320, 'sits at the remaining-span center, not the left quarter');

const loc = { left: -79, right: 123, top: 180, bottom: 362 };
const gate = { left: 322, right: 478, top: 169, bottom: 280 };
const local = Label.place(
  [{ x: 322, y: 224.578 }, { x: 123, y: 224.578 }],
  { dx: -48, dy: -11.5, width: 96, height: 14 },
  [loc, gate],
);
assert(local.overlap <= 1, '本机命令 corridor is zero-hit');
assert(local.x > 200 && local.x < 250, '本机命令 sits near the gap center, not 173');

const wall = [{ left: -20, right: 420, top: 10, bottom: 70 }];
const crushed = Label.place(points, metrics, wall);
assert(crushed.overlap > 1, 'still places when every sample hits');

console.log('ok label-place');
