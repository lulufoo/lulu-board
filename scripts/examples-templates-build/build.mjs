#!/usr/bin/env node
/**
 * Pack examples/ sources into skill/board/templates (no PNGs, flat files).
 *
 *   examples/board-.../*.bmd   -> skill/board/templates/board/<file>.bmd
 *
 * Directory name prefix (board-) picks the destination.
 * AI-facing skill/board/templates/demo.bmd is unrelated and left alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const examplesRoot = path.join(repo, 'examples');
const templatesRoot = path.join(repo, 'skill/board/templates');

const KINDS = [
  { prefix: 'board-', ext: '.bmd', outRoot: path.join(templatesRoot, 'board') },
];

function listExampleDirs(prefix) {
  if (!fs.existsSync(examplesRoot)) return [];
  return fs
    .readdirSync(examplesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
    .map((d) => d.name)
    .sort();
}

function packOne({ prefix, ext, outRoot }) {
  const dirs = listExampleDirs(prefix);
  fs.mkdirSync(outRoot, { recursive: true });

  const keep = new Set();
  for (const name of dirs) {
    const srcDir = path.join(examplesRoot, name);
    for (const file of fs.readdirSync(srcDir)) {
      if (!file.endsWith(ext)) continue;
      const from = path.join(srcDir, file);
      const to = path.join(outRoot, file);
      if (keep.has(file)) {
        throw new Error(`duplicate packed name ${file} from ${name}`);
      }
      keep.add(file);
      fs.copyFileSync(from, to);
      console.log(`ok ${path.relative(repo, to)}`);
    }
  }

  for (const ent of fs.readdirSync(outRoot, { withFileTypes: true })) {
    const full = path.join(outRoot, ent.name);
    if (ent.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`rm stale dir ${path.relative(repo, full)}`);
      continue;
    }
    if (!ent.name.endsWith(ext)) continue;
    if (keep.has(ent.name)) continue;
    fs.rmSync(full, { force: true });
    console.log(`rm stale ${path.relative(repo, full)}`);
  }
  return keep.size;
}

let total = 0;
for (const spec of KINDS) {
  total += packOne(spec);
}
console.log(`packed ${total} sources into skill/board/templates/board`);
