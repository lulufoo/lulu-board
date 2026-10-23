'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const View = require('../../../packages/boxes/view/board-view.js');
global.BoardView = View;
require('../../../packages/boxes/item/board-item.js');

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

const httpsLink = View.renderNoteMarkdown('[docs](https://example.com/a)');
assert.ok(httpsLink.includes('<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">docs</a>'));
assert.ok(View.renderNoteMarkdown('[mail](mailto:a@b.com)').includes('href="mailto:a@b.com"'));
assert.ok(View.renderNoteMarkdown('[insecure](http://example.com)').includes('href="http://example.com"'));
assert.ok(View.renderNoteMarkdown('**[x](https://example.com)**').includes('<strong><a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a></strong>'));
assert.ok(View.renderNoteMarkdown('[**x**](https://example.com)').includes('<a href="https://example.com" target="_blank" rel="noopener noreferrer"><strong>x</strong></a>'));

const rejectedJs = View.renderNoteMarkdown('[x](javascript:alert(1))');
assert.ok(!rejectedJs.includes('<a'), 'javascript href stays text');
assert.ok(rejectedJs.includes('[x](javascript:alert(1))'));
const rejectedData = View.renderNoteMarkdown('[x](data:text/html,hi)');
assert.ok(!rejectedData.includes('<a'), 'data href stays text');
assert.ok(!View.renderNoteMarkdown('see https://example.com').includes('<a'), 'bare url stays text');
assert.ok(!View.renderNoteMarkdown('`[x](https://example.com)`').includes('<a'), 'code span is not a link');
assert.ok(!View.renderNoteMarkdown('![x](https://example.com)').includes('<a'), 'image markdown stays text');
assert.ok(View.renderNoteMarkdown('[x](https://example.com/"q)').includes('href="https://example.com/&quot;q"'));

const itemJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/item/board-item.js'), 'utf8');
assert.ok(/usesItemMarkdown\(itemType\)/.test(itemJs), 'mount uses shared markdown gate');
assert.ok(/board-item-md/.test(itemJs), 'markdown class on chip/text/note');
assert.ok(/innerHTML = renderNoteMarkdown/.test(itemJs), 'chip/text/note render markdown');
assert.ok(/isAllowedHref/.test(itemJs), 'href allow-list lives in the renderer');
assert.ok(/noopener noreferrer/.test(itemJs), 'links open safely');

const noteJs = fs.readFileSync(path.join(__dirname, '../../../packages/boxes/item/note.js'), 'utf8');
assert.ok(!/function renderNoteMarkdown/.test(noteJs), 'note does not keep a second renderer');

const vocab = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/skill-assets/vocab.md'), 'utf8');
assert.ok(/`chip`, `text`, and `note` share this markdown subset/.test(vocab), 'vocab shares markdown');
assert.ok(/`\[text\]\(url\)`/.test(vocab), 'vocab documents markdown links');
assert.ok(/mailto:/.test(vocab), 'vocab names allowed protocols');
assert.ok(!/`note` supports only/.test(vocab), 'vocab is not note-only');

const boardJs = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/js/02-board.js'), 'utf8');
assert.ok(/function boardEventIsItemMdLink/.test(boardJs), 'drawer isolates markdown link clicks');
assert.ok((boardJs.match(/boardEventIsItemMdLink\(event\)/g) || []).length >= 5, 'pointerdown click and dblclick skip md links');

const css = fs.readFileSync(path.join(__dirname, '../../../packages/drawer-app/css/03-diagram.css'), 'utf8');
assert.ok(/\.board-item-md a/.test(css), 'markdown links have styles');
assert.ok(!/function renderNoteMarkdown/.test(boardJs), 'drawer has no second markdown renderer');

console.log('ok item-markdown');
