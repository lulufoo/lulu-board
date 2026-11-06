import assert from 'node:assert/strict';
import { createFakeDocument } from './fake-html.mjs';
import {
  listSketchLeaves,
  stampSketchLeaves,
  readSketchLeaf,
  writeSketchLeaf,
  sameSketchLeaves,
  encodeBase64Utf8,
  swapSketchContent,
} from '../../../packages/board-app/workspace/src/core/sketch-source.js';
import DrawerStyleLine from '../../../packages/board-app/workspace/src/core/style-line.js';

const doc = createFakeDocument();
const parse = (html) => doc.parse(html);

const PAGE = '<style>.a{}</style><div class="c"><h1>A freedom<br>board</h1><p>Use <b>x</b> now</p><span> </span>'
  + '<pre>code</pre><a>link</a><script>var x=1</script><p></p></div>';

// Which text can be picked: leaf elements with some text, in document order, as element-index paths.
assert.deepEqual(listSketchLeaves(parse(PAGE)), ['1.0', '1.1.0'], 'a leaf with text and its inline child are pickable, nothing else is');
assert.deepEqual(listSketchLeaves(parse('<p><br></p><p>&nbsp;</p><p> \n </p><p>x</p>')), ['1', '3'], 'a break or plain white space alone is not text; a no-break space is, because HTML does not collapse it');
assert.deepEqual(listSketchLeaves(parse('<p>a&nbsp;b</p>')), ['0'], 'a no-break space inside text is kept');
{
  const root = parse('<div><p>in html</p></div>');
  const svgText = doc.createElement('text');
  svgText.namespaceURI = 'http://www.w3.org/2000/svg';
  svgText.appendChild(doc.createTextNode('in svg'));
  root.childNodes[0].appendChild(svgText);
  assert.deepEqual(listSketchLeaves(root), ['0.0'], 'text inside SVG is out of scope: an outline does not paint on it');
}

// Stamping: ids go on the copy, and an attribute the source already carries must not pass for Board's own.
{
  const root = parse('<div data-lulu-id="9.9" data-lulu-selected="" class="x"><p data-lulu-id="7">hi</p><i data-lulu-selected="">  </i></div>');
  const ids = stampSketchLeaves(root);
  assert.deepEqual(ids, ['0.0']);
  assert.equal(doc.serialize(root), '<div class="x"><p data-lulu-id="0.0">hi</p><i>  </i></div>', 'forged markers are stripped, the one real leaf is stamped');
}
{
  const root = parse(PAGE);
  const before = doc.serialize(root);
  listSketchLeaves(root);
  readSketchLeaf(root, '1.0');
  assert.equal(doc.serialize(root), before, 'listing and reading never touch the tree');
}

// Reading: what the text box shows. HTML collapses white space, so the box does too.
const read = (html, id) => readSketchLeaf(parse(html), id);
assert.deepEqual(read('<h1>A freedom<br>board</h1>', '0'), { tag: 'h1', text: 'A freedom\nboard', lead: '', trail: '' });
assert.deepEqual(read('<h1>\n    A freedom<br>\n    board\n  </h1>', '0'), { tag: 'h1', text: 'A freedom\nboard', lead: ' ', trail: ' ' },
  'pretty-printed white space is not shown; the ends are kept apart');
assert.deepEqual(read('<p>foo<b> bar </b>baz</p>', '0.0'), { tag: 'b', text: 'bar', lead: ' ', trail: ' ' },
  'a space beside an inline neighbor is meaningful, so it is kept apart rather than dropped');
assert.equal(read('<p>a&nbsp;&nbsp;b</p>', '0').text, 'a\u00a0\u00a0b', 'no-break spaces do not collapse');
assert.equal(read('<p>a   b\t\nc</p>', '0').text, 'a b c', 'runs of white space become one space');
assert.equal(read('<p><br>x</p>', '0').text, '\nx', 'a leading break stays a line break');
for (const id of ['', '9.9', 'abc', '0.0.0', '..', '1']) {
  assert.equal(readSketchLeaf(parse(PAGE), id), null, 'not a pickable element: ' + JSON.stringify(id));
}
assert.equal(readSketchLeaf(parse(PAGE), '1.3'), null, '<pre> keeps its white space and is not offered');
assert.equal(readSketchLeaf(parse(PAGE), '1.5'), null, 'script is code');
assert.equal(readSketchLeaf(parse(PAGE), '1.1'), null, 'a paragraph that holds an element is not a leaf');

// Writing: a text node per line and a <br> between them, and never markup.
{
  const root = parse(PAGE);
  const h1 = root.childNodes[1].childNodes[0];
  assert.equal(writeSketchLeaf(root, '1.0', 'New\nTitle'), true);
  assert.equal(doc.serialize(h1), 'New<br>Title');
  assert.deepEqual(listSketchLeaves(root), ['1.0', '1.1.0'], 'the other ids do not move');
  writeSketchLeaf(root, '1.0', 'a\r\nb\rc');
  assert.equal(doc.serialize(h1), 'a<br>b<br>c', 'every line ending is one break');
  writeSketchLeaf(root, '1.0', '<b>x</b> & y');
  assert.equal(doc.serialize(h1), '&lt;b&gt;x&lt;/b&gt; &amp; y', 'text stays text');
  assert.equal(writeSketchLeaf(root, '1.0', ''), true);
  assert.deepEqual(listSketchLeaves(root), ['1.1.0'], 'emptied text is no longer offered');
  assert.equal(writeSketchLeaf(root, '1.0', 'again'), true, 'but it can be written again, so typing can start from empty');
  assert.equal(writeSketchLeaf(root, '1', 'x'), false, 'a container is not written over');
  assert.equal(writeSketchLeaf(root, '1.5', 'x'), false, 'script is not written');
  assert.equal(writeSketchLeaf(root, '9.9', 'x'), false, 'an id that is not there');
  assert.equal(writeSketchLeaf(root, '1.0; x', 'x'), false, 'an id that is not a path');
}

// Round trip: what is written is what is read back, so editing twice does not drift.
{
  const root = parse('<p>foo<b> bar </b>baz</p>');
  const leaf = readSketchLeaf(root, '0.0');
  writeSketchLeaf(root, '0.0', leaf.lead + 'bar' + leaf.trail);
  assert.equal(doc.serialize(root), '<p>foo<b> bar </b>baz</p>', 'writing back the shown text restores the spaces');
  assert.deepEqual(readSketchLeaf(root, '0.0'), leaf);
}

// Did the parse after a write keep the other ids where they were?
assert.equal(sameSketchLeaves(['0', '1', '2'], ['0', '1', '2'], '1'), true);
assert.equal(sameSketchLeaves(['0', '1', '2'], ['0', '2'], '1'), true, 'the edited text may vanish when it is emptied');
assert.equal(sameSketchLeaves(['0', '1', '2'], ['0', '1', '1.0'], '1'), false, 'another id moved');
assert.equal(sameSketchLeaves(['0', '1'], ['0', '1', '2'], '1'), false, 'another id appeared');

// Base64: UTF-8, any length.
for (const text of ['', 'abc', '你好，Sketch', '😀 emoji', '<p>\u00a0</p>', 'x'.repeat(200000), '中'.repeat(70000)]) {
  const encoded = encodeBase64Utf8(text);
  assert.equal(encoded, Buffer.from(text, 'utf8').toString('base64'), 'same bytes as Buffer');
  assert.equal(DrawerStyleLine.decodeSketchContent('content ' + encoded), text, 'the decoder in the drawer reads it back');
}

// The content line is the only line that changes.
{
  const html = '<h1>Hello</h1>';
  const source = 'style abc\nsketch "T"\ncontent ' + encodeBase64Utf8('old') + '\n';
  const next = swapSketchContent(source, html);
  assert.equal(next, 'style abc\nsketch "T"\ncontent ' + encodeBase64Utf8(html) + '\n');
  assert.equal(DrawerStyleLine.decodeSketchContent(next), html);
  const crlf = swapSketchContent('sketch "T"\r\ncontent ' + encodeBase64Utf8('old') + '\r\nafter\r\n', html);
  assert.equal(crlf, 'sketch "T"\r\ncontent ' + encodeBase64Utf8(html) + '\r\nafter\r\n', 'line endings and later lines are kept');
  assert.equal(swapSketchContent('sketch "T"\n', html), null, 'no content line, nothing to swap');
  assert.equal(swapSketchContent('sketch "T"\ncontent\n', html), null, 'an empty content line is not content');
  const sticky = swapSketchContent('content ' + encodeBase64Utf8('<p>$&</p>') + '\n', '<p>$& $1</p>');
  assert.equal(DrawerStyleLine.decodeSketchContent(sticky), '<p>$& $1</p>', 'the replacement is literal');
}

// The whole edit as Board does it: decode, parse, write, serialize, swap, decode.
{
  const original = '<style>.c{x:1}</style><h1>A freedom<br>board</h1>';
  const source = 'sketch "T"\ncontent ' + encodeBase64Utf8(original) + '\n';
  const tpl = doc.createElement('template');
  tpl.innerHTML = DrawerStyleLine.decodeSketchContent(source);
  const before = listSketchLeaves(tpl.content);
  assert.equal(writeSketchLeaf(tpl.content, '1', 'New\nTitle'), true);
  const next = swapSketchContent(source, tpl.innerHTML);
  assert.equal(DrawerStyleLine.decodeSketchContent(next), '<style>.c{x:1}</style><h1>New<br>Title</h1>');
  const again = doc.createElement('template');
  again.innerHTML = tpl.innerHTML;
  assert.equal(sameSketchLeaves(before, listSketchLeaves(again.content), '1'), true);
}

console.log('ok sketch source');
