'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const css = read('packages/drawer-app/css/03-diagram.css');
const sync = read('packages/drawer-app/js/06-cloud-sync.js');
const pull = read('packages/drawer-app/js/06-cloud-pull.js');
const appBuild = read('scripts/drawer-app-build/build.mjs');

assert.match(html, /<button class="shell-cloud-status is-current" id="shellCloudStatus" type="button" hidden>/, 'green Saved is a button');
assert.match(css, /\.shell-cloud-status\.is-current \{[^}]*cursor:\s*pointer/, 'green Saved looks clickable');
assert.match(sync, /title: "Sync"/, 'green tip says Sync (click pulls)');
assert.match(pull, /bindChromeTip\(status,/, 'green control uses the self-drawn tip');
assert.match(appBuild, /06-cloud-sync\.js[\s\S]*06-cloud-pull\.js[\s\S]*06-cloud-group-tabs\.js/, 'pull module is built after sync');

assert.match(pull, /getElementById\("shellCloudStatus"\)/, 'pull is wired to the green control');
assert.match(pull, /from\("boards"\)[\s\S]*\.eq\("board_id", boardId\)[\s\S]*maybeSingle/, 'pull reads the boards row by id');
assert.doesNotMatch(pull, /cloudCachedBoardRow/, 'pull never reads the memory cache');
assert.match(pull, /cloudForgetBoardCache\(\[boardId\]\)/, 'pull drops the stale cache slot');
assert.match(pull, /cloudPlusDraftActive\) return false/, 'plus draft has nothing to pull');
assert.match(pull, /isShareGuest/, 'share guests do not pull');
assert.match(pull, /boardDirty && typeof askConfirm/, 'dirty local edits ask before overwrite');
assert.doesNotMatch(pull, /saveBoardToCloud|\.update\(|\.insert\(/, 'pull never writes the cloud');

// brown stays upload
const wire = sync.slice(sync.indexOf('var save = document.getElementById("btnShellSaveCloud");', sync.indexOf('function wireCloudAuth')));
assert.match(wire, /saveBoardToCloud\(\{ explicit: true \}\)/, 'brown Saved still uploads');

console.log('ok cloud-pull');
