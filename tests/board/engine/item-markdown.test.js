'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
require('../../../packages/board/item/board-item.js');

assert.strictEqual(View.usesItemMarkdown('chip'), true);
assert.strictEqual(View.usesItemMarkdown('text'), true);
assert.strictEqual(View.usesItemMarkdown('note'), true);
assert.strictEqual(View.usesItemMarkdown('icon'), false);

assert.ok(View.renderNoteMarkdown('**x**').includes('<strong>x</strong>'));
assert.ok(View.renderNoteMarkdown('*y*').includes('<em>y</em>'));
assert.ok(View.renderNoteMarkdown('`z`').includes('<code>z</code>'));
assert.ok(View.renderNoteMarkdown('# Title').includes('<h1>Title</h1>'));
assert.ok(View.renderNoteMarkdown('## Title').includes('<h2>Title</h2>'));
assert.ok(View.renderNoteMarkdown('### Title').includes('<h3>Title</h3>'));
assert.ok(View.renderNoteMarkdown('- a\n- b').includes('<ul><li>a</li><li>b</li></ul>'));
assert.ok(View.renderNoteMarkdown('1. a\n2. b').includes('<ol><li>a</li><li>b</li></ol>'));
assert.ok(View.renderNoteMarkdown(View.decodeItemNewlines('line1\\nline2')).includes('<br>'));
assert.ok(View.renderNoteMarkdown('<script>').includes('&lt;script&gt;'));

const itemJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/item/board-item.js'), 'utf8');
assert.ok(/usesItemMarkdown\(itemType\)/.test(itemJs), 'mount uses shared markdown gate');
assert.ok(/board-item-md/.test(itemJs), 'markdown class on chip/text/note');
assert.ok(/innerHTML = renderNoteMarkdown/.test(itemJs), 'chip/text/note render markdown');

const noteJs = fs.readFileSync(path.join(__dirname, '../../../packages/board/item/note.js'), 'utf8');
assert.ok(!/function renderNoteMarkdown/.test(noteJs), 'note does not keep a second renderer');

const vocab = fs.readFileSync(path.join(__dirname, '../../../skill/board/references/vocab.md'), 'utf8');
assert.ok(/`chip`, `text`, and `note` share this markdown subset/.test(vocab), 'vocab shares markdown');
assert.ok(!/`note` supports only/.test(vocab), 'vocab is not note-only');

console.log('ok item-markdown');
