#!/usr/bin/env node
/**
 * Sandbox runner build: packages/sandbox-app into .cache/sandbox/.
 * The runner page is written as index.html because the whole sandbox domain is the runner: it is served at /.
 * runner-<hash>.js is the bundle (runner logic + SnapDOM).
 * _headers carries the CSP response header for a Workers static assets Worker.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { runnerHeadersFile } from '../../packages/sandbox-app/src/headers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const srcDir = path.join(repo, 'packages/sandbox-app');
const outDir = path.join(repo, '.cache/sandbox');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const built = await esbuild.build({
  absWorkingDir: repo,
  entryPoints: [path.join(srcDir, 'src/main.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  write: false,
});
const bytes = Buffer.from(built.outputFiles[0].contents);
const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
const jsName = 'runner-' + hash + '.js';
writeFileSync(path.join(outDir, jsName), bytes);

const html = readFileSync(path.join(srcDir, 'runner.html'), 'utf8');
if (!html.includes('./runner.js')) throw new Error('runner.html missing ./runner.js');
writeFileSync(path.join(outDir, 'index.html'), html.replace('./runner.js', './' + jsName));
writeFileSync(path.join(outDir, '_headers'), runnerHeadersFile());
console.log('ok sandbox runner ' + jsName + ' (' + bytes.length + ' bytes)');
