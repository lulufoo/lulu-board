#!/usr/bin/env node
/**
 * Public site build: compiled viewer assets into .cache/web/. Does not copy skill/.
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
runBuild('scripts/board-build/build.mjs');
runBuild('scripts/drawer-app-build/build.mjs');

mkdirSync(webVendor, { recursive: true });
const vendorFiles = [
  'board-themes.min.js',
  'boxes.min.js',
  'drawer-app.css',
  'drawer-app.js',
  'drawer-app-early-head.js',
  'drawer-app-early-hydrate.js',
  'supabase-config.js',
  'supabase-client.js',
  'snapdom.mjs',
  'pele.global.js',
  'flowchart.min.js',
  'mindmap.min.js',
];
for (const name of vendorFiles) {
  const src = path.join(webVendor, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  console.log('ok .cache/web/vendor/' + name);
}

for (const name of ['favicon.svg', 'favicon-32.png', 'favicon.ico']) {
  const src = path.join(webDir, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  console.log('ok .cache/web/' + name);
}

{
  const templatesSrc = path.join(repo, 'packages/drawer-app/templates');
  const templatesOut = path.join(webDir, 'templates');
  const names = readdirSync(templatesSrc).sort();
  if (names.length !== 13) throw new Error('expected 13 templates, got ' + names.length);
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
writeFileSync(path.join(webDir, 'index.html'), html);
console.log('ok .cache/web/index.html');

const consentSrc = path.join(repo, 'packages/drawer-app/oauth/consent');
const consentOut = path.join(webDir, 'oauth/consent');
mkdirSync(consentOut, { recursive: true });
for (const name of ['index.html', 'consent.css', 'consent.js']) {
  const src = path.join(consentSrc, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(consentOut, name));
  console.log('ok .cache/web/oauth/consent/' + name);
}

const landingSrc = path.join(repo, 'packages/drawer-app/landing');
const landingOut = path.join(webDir, 'landing');
mkdirSync(landingOut, { recursive: true });
mkdirSync(path.join(landingOut, 'fonts'), { recursive: true });
for (const name of [
  'index.html', 'landing-base.css', 'landing-sections.css', 'landing.js', 'hero-art.webp',
  'agent-chat.webp', 'board-shot.webp',
  'fonts/instrument-serif-latin-400-normal.woff2', 'fonts/inter-latin-wght-normal.woff2',
  'fonts/OFL-instrument-serif.txt', 'fonts/OFL-inter.txt',
]) {
  const src = path.join(landingSrc, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(landingOut, name));
  console.log('ok .cache/web/landing/' + name);
}

rmSync(path.join(webDir, 'css'), { recursive: true, force: true });

const skillAssetsSrc = path.join(repo, 'packages/drawer-app/skill-assets');
const skillAssetsOut = path.join(webDir, 'skill-assets');
rmSync(skillAssetsOut, { recursive: true, force: true });
mkdirSync(skillAssetsOut, { recursive: true });
for (const name of ['vocab.md', 'icons.json']) {
  const src = path.join(skillAssetsSrc, name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(skillAssetsOut, name));
  console.log('ok .cache/web/skill-assets/' + name);
}

// md5 manifest over the shipped bytes (no newline normalisation); the skill compares it with its local cache
const manifest = { version: 1, files: {} };
for (const name of readdirSync(skillAssetsOut).sort()) {
  if (name === 'manifest.json') continue;
  const bytes = readFileSync(path.join(skillAssetsOut, name));
  manifest.files[name] = { md5: createHash('md5').update(bytes).digest('hex'), bytes: bytes.length };
}
writeFileSync(path.join(skillAssetsOut, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('ok .cache/web/skill-assets/manifest.json');

// Workers Assets: revalidate skill-assets on every fetch so the manifest is never stale
writeFileSync(path.join(webDir, '_headers'), '/skill-assets/*\n  Cache-Control: no-cache\n');
console.log('ok .cache/web/_headers');
