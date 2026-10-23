'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const appBuild = fs.readFileSync(path.join(root, 'scripts/drawer-app-build/build.mjs'), 'utf8');
const webBuild = fs.readFileSync(path.join(root, 'scripts/web-build/build.mjs'), 'utf8');
const names = fs.readdirSync(path.join(root, 'packages/drawer-app/templates')).sort();

assert.strictEqual(names.length, 14, 'source templates stay at 14');
assert.match(appBuild, /path\.join\(srcDir, 'templates'\)/, 'drawer-app-build copies templates/');
assert.match(appBuild, /path\.join\(webDir, 'templates'\)/, 'drawer-app-build writes .cache/web/templates');
assert.match(appBuild, /expected 14 templates/, 'drawer-app-build refuses a short template set');
assert.doesNotMatch(appBuild, /onboarding\.bmd/, 'drawer-app-build no longer ships root onboarding.bmd');
assert.match(webBuild, /\.cache\/web\/templates/, 'web-build checks shipped templates');
assert.match(webBuild, /expected 14 templates/, 'web-build refuses a short template set');
assert.doesNotMatch(webBuild, /onboarding\.bmd/, 'web-build no longer requires root onboarding.bmd');

console.log('ok templates-build');
