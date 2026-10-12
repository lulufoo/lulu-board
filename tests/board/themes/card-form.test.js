'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Themes = require('../../../packages/board/themes');

// default pack: warm card fill, deeper chips on the canvas than inside a card
const pack = Themes.get('default');
const sw = pack.swatches[0];
assert.strictEqual(sw.bg, '#fffdf9');
assert.notStrictEqual(sw.canvasItem, sw.item, 'canvas chips are deeper than chips inside a card');

// form layer: cards are borderless, rounded and lifted; nested cards only deepen the fill
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/04-board-form.css'), 'utf8');
assert.match(css, /\.box\.board-type-card\s*\{[^}]*border:\s*0 !important/);
assert.match(css, /\.board-type-card \.box\.board-type-card\s*\{[^}]*box-shadow:\s*none/);
console.log('ok card-form');

// container keeps the dashed shell but follows the same 12px corner as cards
const form = css;
assert.match(form, /board-type-container,[^{]*\{\s*border-radius:\s*var\(--bf-radius-box\) !important/);
const diagram = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
assert.match(diagram, /border:\s*1\.5px dashed var\(--board-container-zone-border/);
assert.doesNotMatch(diagram, /board-type-container > \.box-title[^}]*opacity:\s*0\.72/);

// chips: borderless, 8px, warm inline code
assert.match(css, /board-item-type-chip:not\(\.board-item-diamond\)\s*\{[^}]*border:\s*0 !important[^}]*border-radius:\s*var\(--bf-radius-chip\)/);
assert.match(css, /\.board-item-md code\s*\{[^}]*rgba\(90, 67, 48/);

// diamond chip: no outline; fill follows the parent box like the rect chip
assert.match(css, /board-item-diamond-face\s*\{[^}]*stroke:\s*none/);
assert.match(css, /board-type-card > \.box-content > \.board-item-diamond \.board-item-diamond-face/);

// note: cream paper without an outline, quieter title
assert.match(css, /board-item-note-sheet\s*\{[^}]*background:\s*#fff6dc[^}]*border:\s*0/);
assert.match(css, /board-item-note \.board-item-md h1\s*\{[^}]*font-size:\s*1\.15em/);
