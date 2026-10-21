#!/usr/bin/env node
/**
 * Bundle packages/mermaid-ext/<name>/index.js → packages/drawer-app/vendor/<name>.min.js
 *
 * Usage:
 *   node scripts/mermaid-ext-build/build.mjs           # all present
 *   node scripts/mermaid-ext-build/build.mjs flowchart  # one or more
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const extRoot = path.join(repo, 'packages', 'mermaid-ext');
const vendorOut = path.join(repo, 'packages', 'drawer-app', 'vendor');
const boardBuildDir = path.join(repo, 'scripts', 'board-build');

const require = createRequire(path.join(boardBuildDir, 'package.json'));
const esbuild = require('esbuild');

const all = fs
  .readdirSync(extRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => fs.existsSync(path.join(extRoot, name, 'index.js')))
  .sort();

const requested = process.argv.slice(2);
const targets = requested.length ? requested : all;

fs.mkdirSync(vendorOut, { recursive: true });

for (const name of targets) {
  if (!all.includes(name)) {
    console.error(`unknown mermaid-ext "${name}" (have: ${all.join(', ')})`);
    process.exit(1);
  }
  const entry = path.join(extRoot, name, 'index.js');
  const outFile = path.join(vendorOut, `${name}.min.js`);
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    target: 'es2018',
    format: 'iife',
    outfile: outFile,
  });
  console.log(`ok ${outFile} ${fs.statSync(outFile).size} bytes`);
}
