#!/usr/bin/env node
/**
 * Bundle vendored TypeScript source (vendor/mermaid-layout-elk/src)
 * into assets/vendor/layout-elk.min.js for the drawer page.
 */
import { createRequire } from 'node:module';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const packages = path.join(repo, 'packages');
const assetsRoot = path.join(repo, 'skill/assets');
const entry = path.join(here, 'entry.js');
const outFile = path.join(assetsRoot, 'vendor/layout-elk.min.js');
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const elkBundled = path.join(here, 'node_modules/elkjs/lib/elk.bundled.js');

// stub mermaid for type-only / erased imports (runtime uses globalThis.mermaid)
const mermaidStub = path.join(here, 'mermaid-stub.js');
writeFileSync(
  mermaidStub,
  'export default globalThis.mermaid;\nexport const createCommonLayoutRenderer = undefined;\n'
);

mkdirSync(path.dirname(outFile), { recursive: true });

await esbuild.build({
  absWorkingDir: here,
  entryPoints: [entry],
  bundle: true,
  minify: true,
  target: 'es2018',
  format: 'iife',
  globalName: '__drawerLayoutElk',
  outfile: outFile,
  platform: 'browser',
  loader: { '.ts': 'ts' },
  nodePaths: [path.join(here, 'node_modules')],
  alias: {
    'elkjs/lib/elk.bundled.js': elkBundled,
    mermaid: mermaidStub,
  },
  logLevel: 'info',
});

console.log(`ok ${outFile} ${statSync(outFile).size} bytes (from TypeScript source)`);
