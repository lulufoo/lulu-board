'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const order = read('packages/drawer-app/js/06-cloud-group-order.js');
const tabs = read('packages/drawer-app/js/06-cloud-group-tabs.js');
const tabCss = read('packages/drawer-app/css/06-group-tabs.css');
const appBuild = read('scripts/drawer-app-build/build.mjs');

assert.match(appBuild, /06-cloud-group-tabs\.js[\s\S]*06-cloud-group-order\.js/, 'order module is built after the tabs');
assert.match(tabCss, /\.group-tab\.is-dragging/, 'dragged tab is dimmed');
assert.match(tabCss, /\.group-tab\.is-drop/, 'drop target is outlined');

{
  const start = order.indexOf('function moveBoardId');
  const end = order.indexOf('async function cloudReorderGroupTabs');
  assert.ok(start >= 0 && end > start, 'moveBoardId is a closed function');
  const { moveBoardId } = new Function(order.slice(start, end) + '\nreturn { moveBoardId };')();
  const ids = ['b_1', 'b_2', 'b_3'];
  assert.deepStrictEqual(moveBoardId(ids, 'b_1', 'b_3'), ['b_2', 'b_3', 'b_1'], 'drag first onto last');
  assert.deepStrictEqual(moveBoardId(ids, 'b_3', 'b_1'), ['b_3', 'b_1', 'b_2'], 'drag last onto first');
  assert.deepStrictEqual(moveBoardId(ids, 'b_2', 'b_2'), ids, 'same tab is a no-op');
  assert.deepStrictEqual(moveBoardId(ids, 'b_9', 'b_1'), ids, 'unknown id is a no-op');
  assert.deepStrictEqual(ids, ['b_1', 'b_2', 'b_3'], 'input is not mutated');
}

const reorder = order.slice(order.indexOf('async function cloudReorderGroupTabs'), order.indexOf('function cloudTabFromEvent'));
assert.match(reorder, /rpc\("reorder_group_boards"/, 'drop saves through the reorder rpc');
assert.match(reorder, /p_group_id:\s*groupId/, 'rpc carries the group id');
assert.match(reorder, /p_board_ids:\s*next/, 'rpc carries the full new order');
assert.match(reorder, /cloudGroupMembers = before/, 'a failed save restores the old order');
assert.match(reorder, /groupId !== cloudGroupId/, 'a group switch mid-save leaves state alone');
assert.doesNotMatch(reorder, /from\("group_members"\)|\.update\(/, 'order is not written row by row from the browser');

assert.match(tabs, /btn\.draggable = true/, 'saved numbered tabs are draggable');
const plusSlice = tabs.slice(tabs.indexOf('var draft = document.createElement'), tabs.indexOf('function cloudClearGroupTabs'));
assert.doesNotMatch(plusSlice, /draggable/, 'the plus draft and + are not draggable');
assert.match(order, /\.group-tab\[data-board-id\]/, 'only tabs with a board id take part');

console.log('ok cloud-group-order');
