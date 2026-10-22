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
assert.match(tabCss, /\.group-tab-drop-line \{/, 'slots live in the tab strip');
assert.match(tabCss, /background: transparent/, 'idle slots are invisible');
assert.match(tabCss, /\.group-tab-drop-line\.is-on::after/, 'the chosen slot lights up');
assert.match(tabCss, /padding:\s*0 4px 8px/, 'no extra pad above the first line');
assert.doesNotMatch(tabCss, /flex-basis:\s*16px/, 'every line slot is the same height');
assert.doesNotMatch(tabCss, /\.group-tab\.is-drop\s*\{/, 'drop no longer outlines the whole tab');

{
  const start = order.indexOf('function moveDiagramId');
  const end = order.indexOf('async function cloudReorderGroupTabs');
  assert.ok(start >= 0 && end > start, 'moveDiagramId is a closed function');
  const { moveDiagramId } = new Function(order.slice(start, end) + '\nreturn { moveDiagramId };')();
  const ids = ['b_1', 'b_2', 'b_3'];
  assert.deepStrictEqual(moveDiagramId(ids, 'b_2', 'b_1', false), ['b_2', 'b_1', 'b_3'], 'drag 2 before 1');
  assert.deepStrictEqual(moveDiagramId(ids, 'b_2', 'b_1', true), ids, 'drag 2 after 1 is a no-op');
  assert.deepStrictEqual(moveDiagramId(ids, 'b_1', 'b_3', true), ['b_2', 'b_3', 'b_1'], 'drag 1 after 3');
  assert.deepStrictEqual(moveDiagramId(ids, 'b_1', 'b_3', false), ['b_2', 'b_1', 'b_3'], 'drag 1 before 3');
  assert.deepStrictEqual(moveDiagramId(ids, 'b_3', 'b_1', false), ['b_3', 'b_1', 'b_2'], 'drag 3 before 1');
  assert.deepStrictEqual(moveDiagramId(ids, 'b_2', 'b_2', false), ids, 'same tab before is a no-op');
  assert.deepStrictEqual(moveDiagramId(ids, 'b_9', 'b_1', false), ids, 'unknown id is a no-op');
  assert.deepStrictEqual(ids, ['b_1', 'b_2', 'b_3'], 'input is not mutated');
}

{
  const start = order.indexOf('function cloudTabDropTarget');
  const end = order.indexOf('function cloudSlotLine');
  assert.ok(start >= 0 && end > start, 'cloudTabDropTarget is a closed function');
  const { cloudTabDropTarget } = new Function(
    order.slice(start, end) + '\nreturn { cloudTabDropTarget };'
  )();
  const tab = (top, height, id) => ({
    dataset: { diagramId: id },
    getBoundingClientRect: () => ({ top, height, bottom: top + height }),
  });
  const root = { querySelectorAll: () => [tab(0, 32, 'b_1'), tab(36, 32, 'b_2'), tab(72, 32, 'b_3')] };
  assert.strictEqual(cloudTabDropTarget(root, 10).tab.dataset.diagramId, 'b_1', 'top of 1');
  assert.strictEqual(cloudTabDropTarget(root, 10).after, false, 'top of 1 is before 1');
  assert.strictEqual(cloudTabDropTarget(root, 20).after, true, 'bottom of 1 is after 1');
  assert.strictEqual(cloudTabDropTarget(root, 20).tab.dataset.diagramId, 'b_1', 'bottom of 1 still names 1');
  assert.strictEqual(cloudTabDropTarget(root, 40).after, false, 'top of 2 is before 2');
  assert.strictEqual(cloudTabDropTarget(root, 90).after, true, 'below last tab is after last');
  assert.strictEqual(cloudTabDropTarget(root, 90).tab.dataset.diagramId, 'b_3', 'below last names last');
}

const reorder = order.slice(order.indexOf('async function cloudReorderGroupTabs'), order.indexOf('function cloudTabFromEvent'));
assert.match(reorder, /rpc\("reorder_group_graphs"/, 'drop saves through the reorder rpc');
assert.match(reorder, /p_group_id:\s*groupId/, 'rpc carries the group id');
assert.match(reorder, /p_graph_ids:\s*next/, 'rpc carries the full new order');
assert.match(reorder, /moveDiagramId\(ids, fromId, toId, after\)/, 'rpc uses the before\/after slot');
assert.match(reorder, /cloudGroupMembers = before/, 'a failed save restores the old order');
assert.match(reorder, /groupId !== cloudGroupId/, 'a group switch mid-save leaves state alone');
assert.doesNotMatch(reorder, /from\("group_members"\)|\.update\(/, 'order is not written row by row from the browser');

assert.match(order, /cloudSlotLine/, 'dragover lights a pre-rendered slot');
assert.match(order, /line\.classList\.add\("is-on"\)/, 'the chosen slot is shown');
assert.doesNotMatch(order, /insertBefore|appendChild|createElement/, 'drag does not insert a new line');
assert.match(order, /cloudMarkTabDrop/, 'pointer Y chooses the insert slot');
assert.match(tabs, /function appendGroupDropLine/, 'numbered tabs render idle slots');
assert.match(tabs, /appendGroupDropLine\(root, "is-start"\)/, 'a slot sits before the first tab');
assert.match(tabs, /appendGroupDropLine\(root, index === last \? "is-end" : ""\)/, 'a slot sits after every numbered tab');
assert.match(tabs, /btn\.draggable = true/, 'saved numbered tabs are draggable');
const plusSlice = tabs.slice(tabs.indexOf('var draft = document.createElement'), tabs.indexOf('function cloudClearGroupTabs'));
assert.doesNotMatch(plusSlice, /draggable/, 'the plus draft and + are not draggable');
assert.match(order, /\.group-tab\[data-board-id\]/, 'only tabs with a board id take part');

console.log('ok cloud-group-order');
