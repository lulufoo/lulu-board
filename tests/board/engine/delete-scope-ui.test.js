'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../..');
const boardJs = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-board.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/03-diagram.css'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skill/drawer/SKILL.md'), 'utf8');

assert.ok(/function boardWantsTreeSelect/.test(boardJs), 'tree select reads modifier keys');
assert.ok(/function boardTreeTargetEl/.test(boardJs), 'tree select can climb from a nested item');
assert.ok(/scope === "tree"/.test(boardJs), 'box selection stores tree scope');
assert.ok(/"tree:"/.test(boardJs), 'tree selection key is tree:ID');
assert.ok(/board-selection-tree/.test(css), 'tree selection has its own outline');
assert.ok(/⌘\/Ctrl-click box tree/.test(skill), 'drawer SKILL names tree select');
assert.ok(/shell dissolves/.test(skill), 'drawer SKILL names dissolve delete');

console.log('ok delete-scope-ui');
