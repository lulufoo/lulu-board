#!/usr/bin/env node
/**
 * drawer-app build: vendor/drawer-app → assets outputs.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const packages = path.join(repo, 'packages');
const assetsRoot = path.join(repo, 'skill/assets');
const srcDir = path.join(packages, 'drawer-app');
const assetsDir = assetsRoot;
const vendorOut = path.join(assetsDir, 'vendor');
mkdirSync(vendorOut, { recursive: true });

const srcHtml = path.join(srcDir, 'index.html');
const outHtml = path.join(assetsDir, 'drawer.html');
if (!existsSync(srcHtml)) throw new Error('missing ' + srcHtml);

// CSS
const cssDir = path.join(srcDir, 'css');
const cssFiles = existsSync(cssDir)
  ? readdirSync(cssDir).filter((f) => f.endsWith('.css')).sort()
  : [];
if (cssFiles.length) {
  const body = cssFiles
    .map((f) => `/* --- ${f} --- */\n` + readFileSync(path.join(cssDir, f), 'utf8'))
    .join('\n');
  writeFileSync(path.join(vendorOut, 'drawer-app.css'), body);
  console.log(`ok drawer-app.css (${body.split('\n').length} lines)`);
}

// Early classic scripts (copy as-is)
const jsDir = path.join(srcDir, 'js');
const earlyMap = {
  '00-early-head.js': 'drawer-app-early-head.js',
  '00-early-hydrate.js': 'drawer-app-early-hydrate.js',
  '00-mermaid-alias.js': 'drawer-app-mermaid-alias.js',
};
for (const [name, outName] of Object.entries(earlyMap)) {
  const src = path.join(jsDir, name);
  if (!existsSync(src)) continue;
  copyFileSync(src, path.join(vendorOut, outName));
  console.log(`ok ${outName}`);
}

for (const name of ['snapdom.mjs']) {
  const src = path.join(srcDir, 'vendor', name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(vendorOut, name));
  console.log(`ok ${name}`);
}

// Main module: concat domain files in order (still one ES module when loaded)
const domain = [
  '00-style-line.js',
  '00-document-meta.js',
  '00-canvas-view.js',
  '01-shell-state.js',
  '02-board.js',
  '03-mermaid-inspect.js',
  '03-mermaid.js',
  '04-mindmap.js',
  '04-state.js',
  '05-render-io.js',
  '05-export-png.js',
  '06-view-sequence.js',
  '07-chrome-boot.js',
];
const parts = domain.map((f) => {
  const p = path.join(jsDir, f);
  if (!existsSync(p)) throw new Error('missing ' + p);
  return `/* === ${f} === */\n` + readFileSync(p, 'utf8');
});
const mod = parts.join('\n');
writeFileSync(path.join(vendorOut, 'drawer-app.js'), mod);
console.log(`ok drawer-app.js (${mod.split('\n').length} lines, ${domain.length} domains)`);

copyFileSync(srcHtml, outHtml);
console.log(`ok drawer.html (${readFileSync(outHtml, 'utf8').split('\n').length} lines)`);

for (const name of ['favicon.svg', 'favicon-32.png', 'favicon.ico']) {
  const src = path.join(srcDir, 'brand', name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(assetsDir, name));
  console.log('ok ' + name);
}
