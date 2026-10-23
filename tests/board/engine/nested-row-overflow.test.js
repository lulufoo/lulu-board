'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const View = require('../../../packages/boxes/view/board-view.js');

const render = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/engine/board-render.js'), 'utf8');
const boxJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/box/board-box.js'), 'utf8');

assert.ok(typeof View.flexContentNeed === 'function', 'exports flexContentNeed');
assert.ok(/fitNested\(el\)/.test(boxJs), 'nested boxes can grow to content');
assert.ok(/boardContentMinWidth/.test(boxJs), 'nested content width floor is retained');
assert.ok(
  !/if \(padX <= 0 && padY <= 0\) return null/.test(boxJs),
  'layout pad 0 still reports kid span'
);
assert.ok(
  /eachBoxPostOrder[\s\S]*fitNestedBoxes[\s\S]*applyRootFrames/.test(render),
  'fits nested rows from leaves to roots before sizing root frames'
);
assert.ok(
  /resetBoxKidSizes[\s\S]*contentFloorStyle/.test(render),
  'size reset preserves nested content floors'
);

const need = View.flexContentNeed(
  [
    { offsetLeft: 30, offsetWidth: 163, offsetHeight: 133 },
    { offsetLeft: 193, offsetWidth: 36, offsetHeight: 133, isSlot: true },
    { offsetLeft: 229, offsetWidth: 177, offsetHeight: 133 },
    { offsetLeft: 406, offsetWidth: 36, offsetHeight: 133, isSlot: true },
    { offsetLeft: 442, offsetWidth: 201, offsetHeight: 133 },
    { offsetLeft: 643, offsetWidth: 36, offsetHeight: 133, isSlot: true },
    { offsetLeft: 679, offsetWidth: 179, offsetHeight: 133 },
  ],
  { row: true, padX: 60, padY: 56, titleH: 20 }
);

assert.strictEqual(need.w, 888, 'row need includes slot gaps, not just card widths');
assert.ok(need.w > 833, 'row need is wider than a sibling-stretched frame');

const sumOnly = 163 + 177 + 201 + 179 + 60;
assert.ok(need.w > sumOnly, 'slot spans are not dropped from the row need');

const layoutNeed = View.flexContentNeed(
  [
    { offsetLeft: 0, offsetWidth: 186, offsetHeight: 125 },
    { offsetLeft: 186, offsetWidth: 36, offsetHeight: 125, isSlot: true },
    { offsetLeft: 222, offsetWidth: 139, offsetHeight: 125 },
  ],
  { row: true, padX: 0, padY: 0, titleH: 0 }
);
assert.strictEqual(layoutNeed.w, 361, 'layout pad 0 need is LOGIN + slot + HOME');

console.log('ok nested-row-overflow');
