#!/usr/bin/env node
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const packages = path.join(repo, 'packages');
const webVendor = path.join(repo, '.cache/web/vendor');
const srcDir = path.join(packages, 'board');
const outFile = path.join(webVendor, 'board.min.js');
const iconCatalogFile = path.join(repo, 'skill/board/common/icons.json');
const iconPathsFile = path.join(srcDir, 'item/icon-paths.json');

const SCRIPTS = [
  'themes/type-scale.js',
  'themes/packs/default.js',
  'themes/packs/classic.js',
  'themes/packs/pastel.js',
  'themes/packs/kami.js',
  'themes/index.js',
  'view/board-view.js',
  'box/board-box.js',
  'item/board-item.js',
  'box/card.js',
  'box/diamond.js',
  'box/container.js',
  'box/layout.js',
  'item/chip.js',
  'item/text.js',
  'item/note.js',
  'item/icons.js',
  'item/icon.js',
  'engine/board-layout.js',
  'engine/board-route/world.js',
  'engine/board-route/search.js',
  'engine/board-route/fallback.js',
  'engine/board-route/arrow.js',
  'engine/board-route/gates.js',
  'engine/board-route/rank.js',
  'engine/board-route/choose.js',
  'engine/board-route/plan.js',
  'engine/board-route/compose.js',
  'engine/board-route/label.js',
  'engine/board-route/straight.js',
  'engine/board-route.js',
  'engine/board-render.js',
];

const iconCatalog = JSON.parse(readFileSync(iconCatalogFile, 'utf8'));
const iconPaths = JSON.parse(readFileSync(iconPathsFile, 'utf8'));
const catalogIds = new Set();
for (const section of iconCatalog.sections || []) {
  if (!section.id || !Array.isArray(section.icons)) {
    throw new Error(`invalid icon section: ${JSON.stringify(section)}`);
  }
  for (const icon of section.icons) {
    if (!Number.isInteger(icon.n) || !icon.gloss || catalogIds.has(icon.n)) {
      throw new Error(`invalid or duplicate icon: ${JSON.stringify(icon)}`);
    }
    catalogIds.add(icon.n);
  }
}
const pathIds = Object.keys(iconPaths).map(Number);
if (
  pathIds.length !== catalogIds.size ||
  pathIds.some((n) => !Number.isInteger(n) || !iconPaths[n] || !catalogIds.has(n))
) {
  throw new Error('icon catalog and path map must contain the same IDs');
}
const parts = [
  `window.BoardIconsCatalog = ${JSON.stringify(iconCatalog)};\n` +
  `window.BoardIconPaths = ${JSON.stringify(iconPaths)};\n`
];
for (const rel of SCRIPTS) {
  const file = path.join(srcDir, rel);
  parts.push(readFileSync(file, 'utf8'));
}

const require = createRequire(new URL('./package.json', import.meta.url));
const esbuild = require('esbuild');
const result = await esbuild.transform(parts.join('\n'), { loader: 'js', minify: true, target: 'es2018' });
mkdirSync(webVendor, { recursive: true });
writeFileSync(outFile, result.code);
console.log(`ok ${outFile} ${result.code.length} bytes`);
