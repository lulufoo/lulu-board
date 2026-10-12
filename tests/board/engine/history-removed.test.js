'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const app = path.join(__dirname, '../../../packages/drawer-app');
const html = fs.readFileSync(path.join(app, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(app, 'css/03-diagram.css'), 'utf8');
const io = fs.readFileSync(path.join(app, 'js/05-render-io.js'), 'utf8');

// The toolbar History dropdown was replaced by the left drawer (Mine) and search.
assert.ok(!/id="boardHistoryComboInput"/.test(html), 'no History combo input');
assert.ok(!/id="boardHistory"/.test(html), 'no History block on the canvas chrome');
assert.ok(!/\.history-list|\.history-pop/.test(css), 'no History list styles');
assert.ok(!/function (revealHistoryActiveItem|setHistoryComboFace|appendHistoryMetaLine)/.test(io), 'no History combo helpers');
assert.ok(!/data-board-theme="mermaid"/.test(css), 'CSS drops mermaid theme alias');
assert.ok(/function formatVersionLabel/.test(fs.readFileSync(path.join(app, 'js/01-shell-state.js'), 'utf8')), 'version labels stay (Source header uses them)');

console.log('ok history-removed');
