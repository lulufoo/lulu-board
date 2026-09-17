'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const diamondJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/box/diamond.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const renderJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/engine/board-render.js'), 'utf8');

assert.ok(!/alignSelf = rootItem \? 'auto' : 'stretch'/.test(diamondJs), 'fit must not stretch nested diamond');
assert.ok(!/el\.style\.alignSelf = 'stretch'/.test(diamondJs), 'decorate must not force stretch');
assert.ok(/el\.style\.alignSelf = 'auto'/.test(diamondJs), 'diamond host follows parent align');
assert.ok(/placeChipDiamondOverlay\(el, visual, copy, need, rootItem\)/.test(diamondJs), 'nested diamond never fills the host');
assert.ok(
  /function parentWidthStretch[\s\S]*flexDirection\)\.indexOf\('row'\) !== 0/.test(diamondJs),
  'only a column parent can stretch a diamond width'
);
assert.ok(
  /const stretchHost = !rootItem && parentWidthStretch\(el\);/.test(diamondJs),
  'row parents retain the diamond width'
);

const itemRule = css.match(/\.board-item-diamond \{[^}]+\}/);
assert.ok(itemRule, 'item diamond rule');
assert.ok(!/align-self:\s*stretch/.test(itemRule[0]), 'css must not force stretch');
assert.ok(/align-self:\s*auto/.test(itemRule[0]), 'css follows parent align');

assert.ok(/if \(isDiamondKid\(el\)\) return;/.test(renderJs), 'equalize skips diamond size write');

console.log('ok diamond-chip-align');
