'use strict';
const assert = require('assert');
const View = require('../../../packages/board/view/board-view.js');
global.BoardView = View;
require('../../../packages/board/box/board-box.js');
const Layout = require('../../../packages/board/engine/board-layout.js');
global.BoardLayout = Layout;
const Render = require('../../../packages/board/engine/board-render.js');

const layout = (source) => {
  const board = Render.parse(source);
  return Layout.layout(board, new Map([['IN', { w: 80, h: 80 }]]), {
    width: 800,
    adaptive: false,
  });
};

const empty = layout('board Demo\nbox IN 501 "Inbox"\n');
const withMultilineNote = layout(
  'board Demo\nbox IN 501 "Inbox"\n  item type note "# Check\\n- Quote **must** match.\\n- Keep History labels short."\n'
);

assert.strictEqual(
  withMultilineNote.frames.get('IN').w,
  empty.frames.get('IN').w,
  'multiline Markdown source does not widen its parent box'
);
assert.strictEqual(
  new View.Box({
    title: 'Inbox',
    icon: 501,
    items: [{ text: '# Check\n- Quote **must** match.\n- Keep History labels short.' }],
  }).intrinsicMinWidth(),
  empty.frames.get('IN').w,
  'render measurement uses the same parent width floor'
);

console.log('ok box-content-width');
