'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const appBuild = read('scripts/drawer-app-build/build.mjs');
const webBuild = read('scripts/web-build/build.mjs');
const boardBuild = read('scripts/board-build/build.mjs');
const pack = read('scripts/examples-templates-build/build.mjs');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');
const createKind = read('packages/drawer-app/js/09-create-kind-dialog.js');
const src = read('packages/drawer-app/templates/welcome.bmd');

assert.match(createKind, /kind: "welcome"/, 'Welcome is picked from New diagram');
assert.match(html, /id="createKindDialog"/, 'New diagram hosts the welcome pick');
assert.match(html, /diagram-dock-help/, 'shortcuts still sit on the dock rail');
assert.doesNotMatch(appBuild, /onboarding\.bmd/, 'drawer app build no longer copies onboarding.bmd');
assert.doesNotMatch(webBuild, /onboarding\.bmd/, 'web build no longer requires onboarding.bmd');
assert.doesNotMatch(boardBuild, /examples-templates-build/, 'board build does not pack examples into skill');
assert.match(pack, /skip examples-templates-build/, 'example packer is a no-op');
assert.match(boot, /function applyCreateKindPick/, 'Welcome pick uses the shared commit');
assert.doesNotMatch(boot, /openOnboardingHash/, 'welcome has no onboarding helper');
assert.doesNotMatch(boot, /kind === "welcome"/, 'welcome is a template kind');
assert.match(src, /board "Lulu Board"/, 'welcome template is the welcome Board');
assert.ok(!fs.existsSync(path.join(root, 'packages/drawer-app/onboarding.bmd')), 'root onboarding.bmd is gone');
assert.ok(!fs.existsSync(path.join(root, 'skill/boxes/templates/onboarding.bmd')), 'skill no longer holds onboarding');
assert.ok(fs.existsSync(path.join(root, 'skill/boxes/templates/demo.bmd')), 'AI demo template stays');

console.log('ok onboarding-help');
