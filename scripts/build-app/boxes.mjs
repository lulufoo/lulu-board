#!/usr/bin/env node
/**
 * Icon catalog check. Boxes and board-themes ship inside drawer-app.js.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const srcDir = path.join(repo, 'packages/boxes');
const iconCatalogFile = path.join(repo, 'packages/boxes/skill-assets/icons.json');
const iconPathsFile = path.join(srcDir, 'item/icon-paths.json');

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
console.log(`ok boxes icon catalog (${catalogIds.size} icons)`);
