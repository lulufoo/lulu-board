import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const View = require('../../../packages/boxes/view/view.js').default;
require('../../../packages/boxes/box/box.js');
const Layout = require('../../../packages/boxes/engine/layout').default;
const Render = require('../../../packages/boxes/engine/render.js').default;

const layout = (source) => {
  const board = Render.parse(source);
  return Layout.layout(board, new Map([['IN', { w: 80, h: 80 }]]), {
    width: 800,
    adaptive: false,
  });
};

const empty = layout('boxes Demo\nbox IN 501 "Inbox"\n');
const withMultilineNote = layout(
  'boxes Demo\nbox IN 501 "Inbox"\n  item type note "# Check\\n- Quote **must** match.\\n- Keep History labels short."\n'
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
