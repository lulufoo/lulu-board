'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../../packages/drawer-app/js/05-board-file.js'), 'utf8');
const ctx = { boardTitleFromBody: null };
vm.runInNewContext(src, ctx);

assert.strictEqual(ctx.boardTitleFromBody('board "Onboarding"\nbox A\n'), 'Onboarding');
assert.strictEqual(ctx.boardTitleFromBody('%% title Demo\nflowchart TD\n  A-->B\n'), 'Demo');
assert.strictEqual(ctx.boardTitleFromBody('%% title: "Ship"\nflowchart TD\n  A-->B\n'), 'Ship');
assert.strictEqual(ctx.boardTitleFromBody('flowchart TD\n  A-->B\n'), '');
assert.notStrictEqual(ctx.boardTitleFromBody('flowchart TD\n  A-->B\n'), 'flowchart');

console.log('ok board-title');
