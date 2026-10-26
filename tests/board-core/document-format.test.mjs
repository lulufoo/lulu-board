import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  diagramTitleFromBody,
  newGraphId,
  stripDocumentMeta,
} from '../../packages/board-core/document-format.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(
  path.join(here, '../../packages/board-core/document-format.vectors.json'),
  'utf8',
));

for (const row of vectors.strip) {
  assert.equal(stripDocumentMeta(row.in), row.out, row.name);
}
for (const row of vectors.diagramTitleFromBody) {
  assert.equal(diagramTitleFromBody(row.in), row.out, row.name);
}
for (const row of vectors.newGraphId) {
  assert.equal(newGraphId(Uint8Array.from(row.bytes)), row.out, row.name);
}

console.log('ok board-core document-format');
