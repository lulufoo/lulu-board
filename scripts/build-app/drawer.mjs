#!/usr/bin/env node
/**
 * drawer-app build: vendor/drawer-app → .cache/web/.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleStyleToken } from './style-token.mjs';
import { bundleDocumentFormat } from './document-format.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const packages = path.join(repo, 'packages');
const webDir = path.join(repo, '.cache/web');
const srcDir = path.join(packages, 'drawer-app');
const vendorOut = path.join(webDir, 'vendor');
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

const require = createRequire(path.join(repo, 'package.json'));
const esbuild = require('esbuild');

for (const [entry, outName] of [
  ['src/core/early-head-boot.js', 'drawer-app-early-head.js'],
  ['src/core/early-hydrate.js', 'drawer-app-early-hydrate.js'],
]) {
  await esbuild.build({
    absWorkingDir: repo,
    entryPoints: [path.join(srcDir, entry)],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: path.join(vendorOut, outName),
  });
  console.log(`ok ${outName}`);
}

for (const [from, name] of [
  ['third_party/snapdom/snapdom.mjs', 'snapdom.mjs'],
  ['third_party/pele/pele.global.js', 'pele.global.js'],
]) {
  const src = path.join(repo, from);
  if (!existsSync(src)) throw new Error('missing ' + src);
  copyFileSync(src, path.join(vendorOut, name));
  console.log(`ok ${name}`);
}

const srcBuilt = await esbuild.build({
  absWorkingDir: repo,
  entryPoints: [path.join(srcDir, 'src/main.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  write: false,
  external: ['./snapdom.mjs'],
});
const mod = [
  `/* === board-core/style-token === */\n` + await bundleStyleToken(repo),
  `/* === board-core/document-format === */\n` + await bundleDocumentFormat(repo),
  `/* === drawer-app/src/main.js === */\n` + srcBuilt.outputFiles[0].text,
].join('\n');
writeFileSync(path.join(vendorOut, 'drawer-app.js'), mod);
console.log(`ok drawer-app.js (${mod.split('\n').length} lines, from src/main.js)`);

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
    resolveDir: repo,
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

const sentry = {
  dsn: String(process.env.LULU_BOARD_SENTRY_DSN || '').trim(),
};
writeFileSync(
  path.join(vendorOut, 'sentry-config.js'),
  'window.LuluBoardSentryConfig = Object.freeze(' + JSON.stringify(sentry) + ');\n'
);
const sentryBundle = await esbuild.build({
  stdin: {
    contents: [
      'import * as Sentry from "@sentry/browser";',
      'var dsn = window.LuluBoardSentryConfig && window.LuluBoardSentryConfig.dsn;',
      'if (dsn) Sentry.init({ dsn: dsn, defaultIntegrations: false });',
      'window.Sentry = Sentry;',
    ].join('\n'),
    resolveDir: repo,
    sourcefile: 'lulu-board-sentry-client.js',
    loader: 'js',
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  write: false,
});
writeFileSync(path.join(vendorOut, 'sentry-client.js'), sentryBundle.outputFiles[0].text);
console.log(`ok sentry-client.js (${sentryBundle.outputFiles[0].text.length} bytes)`);

{
  const srcTemplates = path.join(srcDir, 'templates');
  const outTemplates = path.join(webDir, 'templates');
  if (!existsSync(srcTemplates)) throw new Error('missing ' + srcTemplates);
  rmSync(outTemplates, { recursive: true, force: true });
  mkdirSync(outTemplates, { recursive: true });
  const names = readdirSync(srcTemplates).sort();
  if (names.length !== 14) throw new Error('expected 14 templates, got ' + names.length);
  for (const name of names) {
    copyFileSync(path.join(srcTemplates, name), path.join(outTemplates, name));
    console.log('ok templates/' + name);
  }
}
