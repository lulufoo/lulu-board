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
