'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('packages/drawer-app/index.html');
const build = read('scripts/drawer-app-build/build.mjs');
const exportPng = read('packages/drawer-app/js/05-export-png.js');
const boot = read('packages/drawer-app/js/07-chrome-boot.js');

assert.match(html, /id="btnCanvasDlPng"(?![^>]*\bhidden\b)/, 'Export panel exposes PNG');
assert.match(build, /05-export-png\.js/, 'build includes PNG export module');
assert.match(build, /snapdom\.mjs/, 'build ships SnapDOM');
assert.match(exportPng, /import\s*\{\s*snapdom\s*\}\s*from\s*['"]\.\/snapdom\.mjs['"]/, 'uses SnapDOM');
assert.match(exportPng, /function paintExportGrid/, 'rebuilds the canvas grid offscreen');
assert.match(exportPng, /function findExportInkBounds/, 'measures visible content before cropping');
assert.match(exportPng, /cropExportCanvas\(captured, surfaceSize\)/, 'crops from visible content bounds');
assert.match(exportPng, /fetch\(['"]\.\/export\.png['"]/, 'writes the PNG through loopback');
assert.match(exportPng, /document\.body\.appendChild/, 'captures an offscreen clone');
assert.match(boot, /btnCanvasDlPng.*exportPng/, 'Export button triggers PNG export');

console.log('ok export-png');
