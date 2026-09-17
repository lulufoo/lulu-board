#!/usr/bin/env node
/**
 * drawer-app build: vendor/drawer-app → .cache/web/.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const packages = path.join(repo, 'packages');
const webDir = path.join(repo, '.cache/web');
const srcDir = path.join(packages, 'drawer-app');
const vendorOut = path.join(webDir, 'vendor');
const boardBuildDir = path.join(repo, 'scripts', 'board-build');
mkdirSync(vendorOut, { recursive: true });

const srcHtml = path.join(srcDir, 'index.html');
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
  '00-cloud-route.js',
  '00-hash-persist.js',
  '00-canvas-view.js',
  '01-shell-state.js',
  '02-board.js',
  '05-render-io.js',
  '05-board-file.js',
  '05-export-png.js',
  '06-cloud-sync.js',
  '07-chrome-boot.js',
  '08-source-lines.js',
];
const parts = domain.map((f) => {
  const p = path.join(jsDir, f);
  if (!existsSync(p)) throw new Error('missing ' + p);
  return `/* === ${f} === */\n` + readFileSync(p, 'utf8');
});
const mod = parts.join('\n');
writeFileSync(path.join(vendorOut, 'drawer-app.js'), mod);
console.log(`ok drawer-app.js (${mod.split('\n').length} lines, ${domain.length} domains)`);

const require = createRequire(path.join(boardBuildDir, 'package.json'));
const esbuild = require('esbuild');
const config = {
  url: String(process.env.LULU_BOARD_SUPABASE_URL || 'https://xjwlxxuafhsfzksxxmtu.supabase.co').trim(),
  publishableKey: String(process.env.LULU_BOARD_SUPABASE_PUBLISHABLE_KEY || '').trim(),
};
writeFileSync(
  path.join(vendorOut, 'supabase-config.js'),
  'window.LuluBoardSupabaseConfig = Object.freeze(' + JSON.stringify(config) + ');\n'
);
const supabaseBundle = await esbuild.build({
  stdin: {
    contents: 'import { createClient } from "@supabase/supabase-js"; window.LuluBoardSupabase = Object.freeze({ createClient });',
    resolveDir: boardBuildDir,
    sourcefile: 'lulu-board-supabase-client.js',
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  write: false,
});
writeFileSync(path.join(vendorOut, 'supabase-client.js'), supabaseBundle.outputFiles[0].text);
console.log(`ok supabase-client.js (${supabaseBundle.outputFiles[0].text.length} bytes)`);

for (const name of ['favicon.svg', 'favicon-32.png', 'favicon.ico']) {
  const src = path.join(srcDir, 'brand', name);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(webDir, name));
  console.log('ok ' + name);
}

{
  const src = path.join(srcDir, 'onboarding.bmd');
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(webDir, 'onboarding.bmd'));
  console.log('ok onboarding.bmd');
}
