#!/usr/bin/env node
/**
 * Public site build: compiled viewer assets into web/. Does not copy skill/.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const webDir = path.join(repo, 'web');
const webVendor = path.join(webDir, 'vendor');
const srcHtml = path.join(repo, 'packages/drawer-app/index.html');

function runBuild(rel) {
  const result = spawnSync(process.execPath, [path.join(repo, rel)], { stdio: 'inherit' });
  if (result.status) process.exit(result.status || 1);
}

runBuild('scripts/board-build/build.mjs');
runBuild('scripts/drawer-app-build/build.mjs');

mkdirSync(webVendor, { recursive: true });
const vendorFiles = [
  'board.min.js',
  'drawer-app.css',
  'drawer-app.js',
  'drawer-app-early-head.js',
  'drawer-app-early-hydrate.js',
  'snapdom.mjs',
];
for (const name of vendorFiles) {
  const src = path.join(webVendor, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  console.log('ok web/vendor/' + name);
}

for (const name of ['favicon.svg', 'favicon-32.png', 'favicon.ico']) {
  const src = path.join(webDir, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  console.log('ok web/' + name);
}

let html = readFileSync(srcHtml, 'utf8');
html = html.replace(
  '<html lang="zh-Hans" data-theme="light">',
  '<html lang="en" data-persist="hash" data-theme="light">'
);
if (!html.includes('data-persist="hash"')) {
  throw new Error('could not mark web index as hash persist');
}
writeFileSync(path.join(webDir, 'index.html'), html);
console.log('ok web/index.html');

rmSync(path.join(webDir, 'css'), { recursive: true, force: true });
