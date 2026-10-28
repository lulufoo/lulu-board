import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchTextFromBody } from '../../packages/board-core/search-text.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

assert.equal(searchTextFromBody(''), '');
assert.equal(searchTextFromBody('   \n'), '');
assert.equal(
  searchTextFromBody('style eyJ0aGVtZSI6Im1pbmktbWFsIn0=\nboxes "Fresh"\nitem Hello\n'),
  'boxes "Fresh" item Hello'
);
assert.equal(
  searchTextFromBody('%% title Demo\n%% style eyJ0aGVtZSI6Im1pbmktbWFsIn0=\nflowchart TD\n  A-->B\n'),
  '%% title Demo flowchart TD A-->B'
);
assert.equal(
  searchTextFromBody('meta eyJpZCI6ImJfYWFiYmNjZGQiLCJ2ZXJzaW9uIjoxfQ==\nboxes "Kept"\n'),
  'boxes "Kept"'
);

const emptyDiv = Buffer.from('<div></div>', 'utf8').toString('base64');
assert.equal(searchTextFromBody('sketch ""\ncontent ' + emptyDiv + '\n'), '');
assert.equal(searchTextFromBody('sketch "Hi"\ncontent ' + emptyDiv + '\n'), 'Hi');

const tagged = Buffer.from('<style>.x{color:red}</style><h2>A <span class="q">HTML</span> board</h2><p>Copy this link.</p>', 'utf8').toString('base64');
assert.equal(
  searchTextFromBody('sketch "A HTML board"\ncontent ' + tagged + '\n'),
  'A HTML board A HTML board Copy this link.'
);
assert.doesNotMatch(
  searchTextFromBody('sketch "A HTML board"\ncontent ' + tagged + '\n'),
  /color:red|<h2/
);

const template = readFileSync(path.join(root, 'packages/drawer-app/templates/sketch.skt'), 'utf8');
const fromTemplate = searchTextFromBody(template);
assert.match(fromTemplate, /A HTML board/);
assert.match(fromTemplate, /Copy this link/);
assert.match(fromTemplate, /Content is written by AI/);
assert.doesNotMatch(fromTemplate, /box-sizing|sketch-board\{/);

console.log('ok board-core search-text');
