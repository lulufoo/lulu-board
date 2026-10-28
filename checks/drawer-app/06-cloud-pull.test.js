import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const css = read('packages/drawer-app/css/03-diagram.css');
const sync = read('packages/drawer-app/src/cloud/cloud-sync.js');
const pull = read('packages/drawer-app/src/cloud/cloud-pull.js');
const appBuild = read('scripts/build-app/drawer.mjs');

assert.match(html, /<button class="shell-cloud-status is-current" id="shellCloudStatus" type="button" hidden>/, 'green Saved is a button');
assert.match(css, /\.shell-cloud-status\.is-current \{[^}]*cursor:\s*pointer/, 'green Saved looks clickable');
assert.match(sync, /title: "Sync"/, 'green tip says Sync (click pulls)');
assert.match(pull, /bindChromeTip\(status,/, 'green control uses the self-drawn tip');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-sync.js')), 'pull module is built after sync');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-pull.js')), 'pull module is built after sync');
assert.ok(fs.existsSync(path.join(root, 'packages/drawer-app/src/cloud/cloud-group-tabs.js')), 'pull module is built after sync');

assert.match(pull, /getElementById\("shellCloudStatus"\)/, 'pull is wired to the green control');
assert.match(pull, /fetchOwnedGraph\(diagramId\)/, 'pull reads the boards row by id');
assert.doesNotMatch(pull, /cloudCachedDiagramRow/, 'pull never reads the memory cache');
assert.match(pull, /cloudForgetDiagramCache\(\[diagramId\]\)/, 'pull drops the stale cache slot');
assert.match(pull, /cloudPlusDraftActive\) return false/, 'plus draft has nothing to pull');
assert.match(pull, /isShareGuest/, 'share guests do not pull');
assert.match(pull, /diagramDirty[\s\S]*call\("askConfirm"/, 'dirty local edits ask before overwrite');
assert.doesNotMatch(pull, /saveDiagramToCloud|\.update\(|\.insert\(/, 'pull never writes the cloud');

// brown stays upload
const wire = sync.slice(sync.indexOf('var save = document.getElementById("btnShellSaveCloud");', sync.indexOf('function wireCloudAuth')));
assert.match(wire, /saveDiagramToCloud\(\{ explicit: true \}\)/, 'brown Saved still uploads');

console.log('ok cloud-pull');
