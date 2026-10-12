'use strict';
const assert = require('assert');
const Themes = require('../../../packages/board/themes');

// default follows the site shell font (+ CJK fallbacks); the other packs keep their own identity
const font = (id) => Themes.get(id).fontFamily;
assert.match(font('default'), /SF Pro Text.*Inter/, 'default uses the site font stack');
assert.match(font('default'), /PingFang SC/, 'default has a CJK sans fallback');
assert.match(font('classic'), /Trebuchet/, 'classic keeps Trebuchet');
assert.match(font('pastel'), /ui-sans-serif/, 'pastel is untouched');
console.log('ok pack-fonts');
