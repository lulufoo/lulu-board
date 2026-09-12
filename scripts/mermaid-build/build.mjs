#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { jisonPlugin } from './jison-plugin.mjs';
import { jsonSchemaPlugin } from './json-schema-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const packages = path.join(repo, 'packages');
const assetsRoot = path.join(repo, 'skill/assets');
const mermaidDir = path.join(packages, 'mermaid-vendor/mermaid');
const parserDir = path.join(packages, 'mermaid-vendor/parser');
const outFile = path.join(assetsRoot, 'vendor/mermaid.min.js');
const nodeModules = path.join(here, 'node_modules');

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.env.MERMAID_SKIP_LANGIUM) {
  run(path.join(nodeModules, '.bin/langium'), ['generate'], parserDir);
}

await esbuild.build({
  absWorkingDir: mermaidDir,
  entryPoints: [path.join(mermaidDir, 'src/mermaid.ts')],
  outfile: outFile,
  bundle: true,
  minify: true,
  keepNames: true,
  platform: 'browser',
  format: 'iife',
  globalName: '__esbuild_esm_mermaid',
  footer: { js: 'globalThis.mermaid = globalThis.__esbuild_esm_mermaid.default;' },
  resolveExtensions: ['.ts', '.js', '.json', '.jison', '.yaml'],
  nodePaths: [nodeModules],
  alias: { '@mermaid-js/parser': path.join(parserDir, 'src/index.ts') },
  plugins: [jisonPlugin, jsonSchemaPlugin],
  define: { 'import.meta.vitest': 'undefined' },
  external: ['require', 'fs', 'path'],
  logLevel: 'info',
});

mkdirSync(path.dirname(outFile), { recursive: true });
console.log(`ok ${outFile}`);
