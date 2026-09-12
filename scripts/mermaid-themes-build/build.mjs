#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const packages = path.join(repo, 'packages');
const assetsRoot = path.join(repo, 'skill/assets');
const srcDir = path.join(packages, 'mermaid-themes');
const outFile = path.join(assetsRoot, 'vendor/mermaid-themes.min.js');
const SCRIPTS = [
  'flowchart/type-scale.js',
  'flowchart/default.js',
  'flowchart/classic.js',
  'flowchart/pastel.js',
  'flowchart/kami.js',
  'mermaid-themes.js',
  'mindmap/default.js',
  'mindmap/classic.js',
  'mindmap/pastel.js',
  'mindmap/kami.js',
  'mindmap/index.js',
  'sequence/default.js',
  'sequence/classic.js',
  'sequence/pastel.js',
  'sequence/kami.js',
  'sequence/index.js',
  'state/default.js',
  'state/classic.js',
  'state/pastel.js',
  'state/kami.js',
  'state/index.js',
];

const body = SCRIPTS.map((rel) => readFileSync(path.join(srcDir, rel), 'utf8')).join('\n');
const require = createRequire(new URL('../mermaid-build/package.json', import.meta.url));
const esbuild = require('esbuild');
const result = await esbuild.transform(body, { loader: 'js', minify: true, target: 'es2018' });
writeFileSync(outFile, result.code);
console.log(`ok ${outFile} ${result.code.length} bytes`);
