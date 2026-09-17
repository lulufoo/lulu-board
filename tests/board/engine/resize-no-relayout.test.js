'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const render = fs.readFileSync(path.join(__dirname, '../../../packages/board/engine/board-render.js'), 'utf8');
const view = fs.readFileSync(path.join(__dirname, '../../../packages/board/view/board-view.js'), 'utf8');
const box = fs.readFileSync(path.join(__dirname, '../../../packages/board/box/board-box.js'), 'utf8');

assert.ok(!/new ResizeObserver/.test(render), 'preview resize does not re-solve');
assert.ok(!/window\.addEventListener\("resize", scheduleResolve\)/.test(render), 'window resize does not re-solve');
assert.ok(/board-layout-halo/.test(view) && /return \{ w: Math\.max\(fallbackW, layoutW\), h: Math\.max\(fallbackH, layoutH\) \}/.test(view), 'halo overflow is not measured');
assert.ok(/isSlot: k\.classList\.contains\('board-slot'\)/.test(box), 'slots are detected');
assert.ok(/if \(!kid\.isSlot\) cross = Math\.max\(cross, row \? kh : kw\);/.test(view), 'slots skip cross size');

console.log('ok resize-no-relayout');
