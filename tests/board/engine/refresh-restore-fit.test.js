'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const shell = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/01-shell-state.js'), 'utf8');
const canvas = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/00-canvas-view.js'), 'utf8');
const board = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/02-board.js'), 'utf8');
const boot = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/07-chrome-boot.js'), 'utf8');

assert.ok(/function applyRestoredBoardView/.test(shell), 'restore helper');
assert.ok(/opts\.restoreView\) \{\s*applyRestoredBoardView\(\)/.test(board), 'renderBoard restore uses helper');
assert.ok(/applyRestoredBoardView\(\)/.test(boot), 'setMode skipBoard uses helper');

// The camera is per-board (style.viewport) only: nothing about it is stored in drawer.ui.
assert.ok(!/boardViewId/.test(shell), 'no per-board view id in drawer.ui');
assert.ok(!/scheduleDrawerUiSave/.test(shell + boot), 'canvas moves do not write drawer.ui');
{
  const start = shell.indexOf('var DRAWER_UI_PERSIST_LIST');
  const list = shell.slice(start, shell.indexOf('];', start));
  assert.ok(!/key: "(scale|panX|panY)"/.test(list), 'persist list has no camera fields');
  const def = shell.slice(shell.indexOf('function defaultDrawerUi'), shell.indexOf('function loadDrawerUi'));
  assert.ok(!/scale|panX|panY/.test(def), 'default drawer.ui has no camera fields');
  const snap = shell.slice(shell.indexOf('function snapshotDrawerUi'), shell.indexOf('var _drawerUiRestoreLock'));
  assert.ok(!/scale|panX|panY/.test(snap), 'drawer.ui snapshot has no camera fields');
  assert.ok(!/ui\.scale|ui\.panX|ui\.panY/.test(shell), 'boot does not hydrate the camera from drawer.ui');
}
assert.ok(/let scale = 1, panX = 0, panY = 0;/.test(shell), 'live camera starts at 100%');

// An empty world has no bounds: it must still reset the camera to 100% centred,
// instead of keeping whatever the previous document left behind.
{
  const fit = canvas.slice(canvas.indexOf('function fitWorld'), canvas.indexOf('\nfunction restoreOrFit'));
  const empty = fit.indexOf('applyCamera({ scale: 1, cx: 0, cy: 0 })');
  assert.ok(/if \(!b\) \{ applyCamera\(\{ scale: 1, cx: 0, cy: 0 \}\); return; \}/.test(fit), 'empty world resets camera to 100% centred');
  assert.ok(empty >= 0 && empty < fit.indexOf('applyCamera({ scale: next'), 'empty branch comes before the fit branch');
  assert.ok(/function applyRestoredBoardView/.test(shell) && /Canvas\.restoreOrFit/.test(shell), 'restore helper calls Canvas');
  assert.ok(/function fitBoardView/.test(shell) && /Canvas\.fitWorld/.test(shell), 'fit helper calls Canvas');
}

console.log('ok refresh-restore-fit');
