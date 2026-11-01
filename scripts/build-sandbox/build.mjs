#!/usr/bin/env node
/**
 * Sandbox runner build: packages/sandbox-app into .cache/sandbox/.
 * The runner page is written as index.html because the whole sandbox domain is the runner: it is served at /.
 * The runner core is inlined into index.html. SnapDOM is capture-<hash>.js, loaded on demand when Board exports.
 * _headers carries the CSP and cache response headers for a Workers static assets Worker.
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

async function bundle(entry) {
  const built = await esbuild.build({
    absWorkingDir: repo,
    entryPoints: [path.join(srcDir, entry)],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    write: false,
  });
  return Buffer.from(built.outputFiles[0].contents);
}

const capture = await bundle('src/capture.js');
const captureName = 'capture-' + createHash('sha256').update(capture).digest('hex').slice(0, 8) + '.js';
writeFileSync(path.join(outDir, captureName), capture);

const core = (await bundle('src/main.js')).toString('utf8');
// An inline script ends at the first closing tag, so none may appear in the bundle.
if (/<\/script/i.test(core)) throw new Error('runner core contains a closing script tag');

const html = readFileSync(path.join(srcDir, 'runner.html'), 'utf8');
if (!html.includes('<!--runner-scripts-->')) throw new Error('runner.html missing the runner-scripts marker');
const scripts = '<script>window.LuluCaptureSrc=' + JSON.stringify('./' + captureName) + ';</script>\n<script>' + core + '</script>';
const page = html.replace('<!--runner-scripts-->', () => scripts);
writeFileSync(path.join(outDir, 'index.html'), page);
writeFileSync(path.join(outDir, '_headers'), runnerHeadersFile());
console.log('ok sandbox runner: index.html ' + Buffer.byteLength(page) + ' bytes, ' + captureName + ' ' + capture.length + ' bytes');
