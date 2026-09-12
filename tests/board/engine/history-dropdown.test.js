'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
const io = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/05-render-io.js'), 'utf8');

assert.ok(/id="mermaidHistoryComboBtn"/.test(html) && /id="boardHistoryComboBtn"/.test(html), 'both Source histories are combos');
assert.ok(/aria-haspopup="listbox"/.test(html), 'History combo exposes a listbox');
assert.ok(!/\.history-list\s*\{[^}]*height:\s*240px/.test(css), 'History list is not a reserved 240px slot');
assert.ok(/max-height:\s*min\(360px,\s*68vh\)/.test(css), 'open History list is 1.5× the first overlay height');
assert.ok(/function openHistoryCombo/.test(io) && /block: "center"/.test(io), 'opening History scrolls the selected row into view');
assert.ok(/function setHistoryComboFace/.test(io), 'closed combo shows the current record');
assert.ok(/function appendHistoryMetaLine/.test(io) && /function formatVersionLabel/.test(fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/01-shell-state.js'), 'utf8')), 'History version uses the same vN token');

console.log('ok history-dropdown');
