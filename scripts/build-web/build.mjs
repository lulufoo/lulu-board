#!/usr/bin/env node
/**
 * Public site build: app + site into .cache/web/. Does not copy skill/.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const webDir = path.join(repo, '.cache/web');
const webVendor = path.join(webDir, 'vendor');
const srcHtml = path.join(repo, 'packages/drawer-app/index.html');

function runBuild(rel) {
  const result = spawnSync(process.execPath, [path.join(repo, rel)], { stdio: 'inherit' });
  if (result.status) process.exit(result.status || 1);
}

rmSync(webDir, { recursive: true, force: true });
runBuild('scripts/build-app/build.mjs');
runBuild('scripts/build-site/build.mjs');

mkdirSync(webVendor, { recursive: true });
const stableVendor = ['supabase-config.js', 'sentry-config.js'];
const hashedVendor = [
  'drawer-app.css',
  'drawer-app.js',
  'drawer-app-early-head.js',
  'drawer-app-early-hydrate.js',
  'supabase-client.js',
  'sentry-client.js',
  'snapdom.mjs',
  'pele.global.js',
];
for (const name of [...stableVendor, ...hashedVendor]) {
  const src = path.join(webVendor, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
}

function contentHashName(name, bytes) {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const ext = path.extname(name);
  return path.basename(name, ext) + '-' + hash + ext;
}

function rewriteVendorRefs(text, renameMap) {
  let out = text;
  for (const [from, to] of Object.entries(renameMap)) {
    const re = new RegExp('(vendor/)' + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    out = out.replace(re, '$1' + to);
  }
  return out;
}

const snapBytes = readFileSync(path.join(webVendor, 'snapdom.mjs'));
const snapHashed = contentHashName('snapdom.mjs', snapBytes);
writeFileSync(path.join(webVendor, snapHashed), snapBytes);
rmSync(path.join(webVendor, 'snapdom.mjs'));

const drawerPath = path.join(webVendor, 'drawer-app.js');
let drawer = readFileSync(drawerPath, 'utf8');
if (!drawer.includes('./snapdom.mjs')) throw new Error('drawer-app.js missing ./snapdom.mjs import');
drawer = drawer.replaceAll('./snapdom.mjs', './' + snapHashed);
writeFileSync(drawerPath, drawer);

const renameMap = { 'snapdom.mjs': snapHashed };
for (const name of hashedVendor) {
  if (name === 'snapdom.mjs') continue;
  const src = path.join(webVendor, name);
  const bytes = readFileSync(src);
  const hashed = contentHashName(name, bytes);
  writeFileSync(path.join(webVendor, hashed), bytes);
  rmSync(src);
  renameMap[name] = hashed;
}

for (const name of stableVendor) console.log('ok .cache/web/vendor/' + name);
for (const name of Object.values(renameMap).sort()) console.log('ok .cache/web/vendor/' + name);

for (const name of ['favicon.svg', 'favicon-32.png', 'favicon.ico']) {
  const src = path.join(webDir, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  console.log('ok .cache/web/' + name);
}

{
  const templatesSrc = path.join(repo, 'packages/drawer-app/templates');
  const templatesOut = path.join(webDir, 'templates');
  const names = readdirSync(templatesSrc).sort();
  if (names.length !== 14) throw new Error('expected 14 templates, got ' + names.length);
  for (const name of names) {
    const src = path.join(templatesOut, name);
    if (!existsSync(src)) throw new Error('missing .cache/web/templates/' + name);
    console.log('ok .cache/web/templates/' + name);
  }
}

let html = readFileSync(srcHtml, 'utf8');
html = html.replace(
  '<html lang="zh-Hans" data-theme="light">',
  '<html lang="en" data-persist="hash" data-theme="light">'
);
if (!html.includes('data-persist="hash"')) {
  throw new Error('could not mark web index as hash persist');
}
html = rewriteVendorRefs(html, renameMap);
for (const name of hashedVendor) {
  if (name === 'snapdom.mjs') continue;
  if (html.includes('vendor/' + name)) throw new Error('web index still points at ' + name);
  if (!html.includes('vendor/' + renameMap[name])) throw new Error('web index missing ' + renameMap[name]);
}
writeFileSync(path.join(webDir, 'index.html'), html);
console.log('ok .cache/web/index.html');

for (const rel of ['landing/index.html', 'oauth/consent/index.html']) {
  const full = path.join(webDir, rel);
  if (!existsSync(full)) throw new Error('missing ' + rel);
  writeFileSync(full, rewriteVendorRefs(readFileSync(full, 'utf8'), renameMap));
  console.log('ok .cache/web/' + rel);
}

rmSync(path.join(webDir, 'css'), { recursive: true, force: true });

const skillAssetsSrc = path.join(repo, 'packages/boxes/skill-assets');
const skillAssetsOut = path.join(webDir, 'skill-assets');
rmSync(skillAssetsOut, { recursive: true, force: true });
mkdirSync(skillAssetsOut, { recursive: true });
for (const name of ['vocab.md', 'icons.json']) {
  const src = path.join(skillAssetsSrc, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(skillAssetsOut, name));
  console.log('ok .cache/web/skill-assets/' + name);
}

const manifest = { version: 1, files: {} };
for (const name of readdirSync(skillAssetsOut).sort()) {
  if (name === 'manifest.json') continue;
  const bytes = readFileSync(path.join(skillAssetsOut, name));
  manifest.files[name] = { md5: createHash('md5').update(bytes).digest('hex'), bytes: bytes.length };
}
writeFileSync(path.join(skillAssetsOut, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('ok .cache/web/skill-assets/manifest.json');

const headerBlocks = [
  '/\n  Cache-Control: no-cache',
  '/index.html\n  Cache-Control: no-cache',
  '/landing/\n  Cache-Control: no-cache',
  '/landing/index.html\n  Cache-Control: no-cache',
  '/oauth/consent/\n  Cache-Control: no-cache',
  '/oauth/consent/index.html\n  Cache-Control: no-cache',
  '/vendor/supabase-config.js\n  Cache-Control: no-cache',
  '/vendor/sentry-config.js\n  Cache-Control: no-cache',
  ...Object.values(renameMap)
    .sort()
    .map((name) => '/vendor/' + name + '\n  Cache-Control: public, max-age=31536000, immutable'),
  '/skill-assets/*\n  Cache-Control: no-cache',
];
writeFileSync(path.join(webDir, '_headers'), headerBlocks.join('\n') + '\n');
console.log('ok .cache/web/_headers');
