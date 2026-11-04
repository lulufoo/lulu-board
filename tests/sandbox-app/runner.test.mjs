import assert from 'node:assert/strict';
import { createRunner } from '../../packages/sandbox-app/src/runner.js';
import {
  SANDBOX_MSG,
  SANDBOX_BLEED,
  renderMessage,
  appearanceMessage,
  captureMessage,
  pickMessage,
  selectMessage,
  textMessage,
} from '../../packages/sandbox-app/src/protocol.js';

/* A fake element for the picking tests: attributes, a parent, and the few methods the runner calls. A target id
 * stamps it the way Board does. */
function fakeElement(target, parent) {
  const attrs = {};
  if (target) attrs['data-lulu-id'] = target;
  const el = {
    attrs,
    parent,
    kids: null,
    setAttribute: (key, value) => { attrs[key] = value; },
    removeAttribute: (key) => { delete attrs[key]; },
    getAttribute: (key) => (key in attrs ? attrs[key] : null),
    replaceChildren: (fragment) => { el.kids = fragment.kids; },
    closest: (selector) => {
      const key = /^\[([a-z-]+)\]$/.exec(selector)[1];
      for (let node = el; node; node = node.parent) if (key in node.attrs) return node;
      return null;
    },
  };
  return el;
}

/* A fake window. `page` is the layout the runner reads and may be changed between reports; `fire()` runs the
 * ResizeObserver callback, which is what a layout change does in a browser. */
function makeEnv({ width = 300, height = 120, toCanvas } = {}) {
  const posted = [];
  const listeners = {};
  const captures = {};
  const mounted = [];
  const parent = { postMessage: (msg, target, transfer) => posted.push({ msg, target, transfer }) };
  const page = { scrollWidth: width, clientWidth: undefined, bodyHeight: height, innerWidth: undefined, innerHeight: undefined };
  const rootStyle = {
    props: {},
    setProperty(name, value, priority) { this.props[name] = { value, priority }; },
    removeProperty(name) { delete this.props[name]; },
  };
  const body = {
    get scrollHeight() { return page.bodyHeight; },
    getBoundingClientRect: () => {
      const top = rootStyle.padding === '0' || rootStyle.padding === undefined ? 0 : parseInt(rootStyle.padding, 10);
      return { top, bottom: top + page.bodyHeight, height: page.bodyHeight };
    },
    appendChild: (node) => mounted.push({ node: node, appearance: documentElement.dataset.appearance }),
    addEventListener: () => {},
  };
  const documentElement = {
    dataset: {},
    get scrollWidth() { return page.scrollWidth; },
    get clientWidth() { return page.clientWidth; },
    style: rootStyle,
  };
  const events = [];
  // What the picking tests drive: the stack elementsFromPoint answers, the elements Board stamped, and the head.
  const stack = { list: [], asked: [] };
  const byTarget = {};
  const head = { kids: [], appendChild(node) { this.kids.push(node); } };
  const doc = {
    documentElement,
    body,
    head,
    createRange: () => ({ selectNodeContents() {}, createContextualFragment: (html) => ({ html }) }),
    dispatchEvent: (ev) => { events.push(ev.type); },
    elementsFromPoint: (x, y) => { stack.asked.push([x, y]); return stack.list; },
    querySelector: (selector) => {
      const hit = /^\[data-lulu-id="([^"]*)"\]$/.exec(selector);
      return hit ? byTarget[hit[1]] || null : null;
    },
    createElement: (name) => Object.assign(fakeElement(null, null), { name, textContent: '' }),
    createTextNode: (text) => ({ text }),
    createDocumentFragment: () => ({ kids: [], appendChild(node) { this.kids.push(node); } }),
  };
  const win = {
    parent,
    Event: function (type) { this.type = type; },
    get innerWidth() { return page.innerWidth; },
    get innerHeight() { return page.innerHeight; },
    addEventListener: (type, fn, capture) => { listeners[type] = fn; captures[type] = capture; },
  };
  let observe = null;
  const runner = createRunner({
    window: win,
    document: doc,
    toCanvas: toCanvas || (async () => ({ width: 600, height: 240 })),
    createImageBitmap: async (canvas) => ({ width: canvas.width, height: canvas.height }),
    ResizeObserver: function (cb) { observe = cb; this.observe = () => {}; },
  });
  return { runner, posted, listeners, captures, parent, mounted, win, page, rootStyle, root: documentElement, events, stack, byTarget, head, fire: () => observe() };
}

const types = (posted) => posted.map((p) => p.msg.type);

{
  const { runner, posted, listeners } = makeEnv();
  runner.start();
  assert.deepEqual(types(posted), [SANDBOX_MSG.READY], 'announces itself once started');
  assert.equal(posted[0].target, '*', 'opaque origin cannot name the parent origin');
  assert.equal(typeof listeners.message, 'function');
}

{
  const { runner, listeners, captures } = makeEnv();
  runner.start();
  assert.equal(typeof listeners.click, 'function', 'the runner watches clicks from the start, before any fragment mounts');
  assert.equal(captures.click, true, 'the click guard runs in the capture phase, ahead of fragment listeners');
}

{
  // A click on a link would navigate the frame away. The guard cancels the default and leaves the event running.
  const { runner, listeners } = makeEnv();
  runner.start();
  const asked = [];
  const click = (target) => {
    const event = {
      target, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
      stopImmediatePropagation() { this.stopped = true; },
    };
    listeners.click(event);
    return event;
  };
  const onLink = click({ closest: (selector) => { asked.push(selector); return {}; } });
  assert.equal(onLink.prevented, true, 'a click on a link does not navigate');
  assert.equal(onLink.stopped, false, "the fragment's own click handlers still run");
  assert.equal(asked[0], 'a[*|href], area[href]', 'HTML anchors, SVG anchors, and image-map areas are all links');
  assert.equal(click({ closest: () => null }).prevented, false, 'a click elsewhere is left alone');
  assert.equal(click({}).prevented, false, 'a target that cannot be searched is left alone');
  assert.equal(click(null).prevented, false, 'an event without a target is left alone');
}

{
  const { runner, posted, parent, mounted } = makeEnv();
  runner.start();
  runner.onMessage({ source: {}, data: renderMessage('<p>evil</p>') });
  assert.equal(mounted.length, 0, 'messages from other windows are ignored');
  runner.onMessage({ source: parent, data: renderMessage('<p>ok</p>') });
  assert.deepEqual(mounted, [{ node: { html: '<p>ok</p>' }, appearance: 'light' }], 'appearance is light before the fragment is inserted');
  const size = posted.find((p) => p.msg.type === SANDBOX_MSG.SIZE);
  assert.deepEqual(size.msg, { type: SANDBOX_MSG.SIZE, width: 300, height: 120 + SANDBOX_BLEED * 2, bleed: SANDBOX_BLEED },
    'the frame is the picture plus the bleed, and the message says how much');
  runner.onMessage({ source: parent, data: renderMessage('<p>second</p>', 'dark') });
  assert.equal(mounted.length, 1, 'a runner renders once');
  assert.equal(posted.filter((p) => p.msg.type === SANDBOX_MSG.SIZE).length, 1, 'size is sent when it changes');
}

{
  const { runner, parent, mounted } = makeEnv();
  runner.start();
  runner.onMessage({ source: parent, data: renderMessage('<p>night</p>', 'dark') });
  assert.deepEqual(mounted, [{ node: { html: '<p>night</p>' }, appearance: 'dark' }], 'dark is stamped before the fragment is inserted');
}

{
  const { runner, parent, mounted, root, events } = makeEnv();
  runner.start();
  runner.onMessage({ source: parent, data: appearanceMessage('dark') });
  assert.equal(root.dataset.appearance, undefined, 'appearance before render is ignored');
  runner.onMessage({ source: parent, data: renderMessage('<p>stay</p>', 'light') });
  runner.onMessage({ source: parent, data: appearanceMessage('dark') });
  assert.equal(mounted.length, 1, 'a theme change does not mount again');
  assert.equal(root.dataset.appearance, 'dark');
  assert.deepEqual(events, ['lulu-appearance']);
  runner.onMessage({ source: parent, data: { type: SANDBOX_MSG.APPEARANCE, appearance: 'nope' } });
  assert.equal(root.dataset.appearance, 'dark', 'an invalid appearance leaves the theme');
}

{
  const calls = [];
  const { runner, posted, parent } = makeEnv({
    toCanvas: async (el, opts) => { calls.push(opts); return { width: 600, height: 240 }; },
  });
  runner.start();
  runner.onMessage({ source: parent, data: renderMessage('<p>x</p>') });
  runner.onMessage({ source: parent, data: captureMessage('c1', 2) });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, [{ backgroundColor: null, dpr: 1, scale: 2 }], 'capture is transparent');
  const done = posted.find((p) => p.msg.type === SANDBOX_MSG.CAPTURED);
  assert.equal(done.msg.id, 'c1');
  assert.deepEqual(done.msg.bitmap, { width: 600, height: 240 });
  assert.equal(done.transfer[0], done.msg.bitmap, 'bitmap is transferred, not copied');
}

{
  const { runner, posted, parent } = makeEnv();
  runner.start();
  runner.onMessage({ source: parent, data: captureMessage('c1', 2) });
  await new Promise((r) => setTimeout(r, 0));
  const err = posted.find((p) => p.msg.type === SANDBOX_MSG.ERROR);
  assert.equal(err.msg.id, 'c1', 'capture before render reports an error');
}

{
  const { runner, posted, parent } = makeEnv({ toCanvas: async () => { throw new Error('boom'); } });
  runner.start();
  runner.onMessage({ source: parent, data: renderMessage('<p>x</p>') });
  runner.onMessage({ source: parent, data: captureMessage('c2', 1) });
  await new Promise((r) => setTimeout(r, 0));
  const err = posted.find((p) => p.msg.type === SANDBOX_MSG.ERROR);
  assert.deepEqual([err.msg.id, err.msg.message], ['c2', 'boom']);
}

{
  const { runner, posted, parent } = makeEnv();
  runner.start();
  runner.onMessage({ source: parent, data: { type: SANDBOX_MSG.CAPTURE, id: 'x', scale: 99 } });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(types(posted), [SANDBOX_MSG.READY], 'invalid capture requests are ignored');
}

const sizes = (posted) => posted.filter((p) => p.msg.type === SANDBOX_MSG.SIZE).map((p) => p.msg);

{
  // The bleed is padding on <html>, set inline, so the picture keeps its own size and the bleed sits around it.
  const { runner, posted, parent, rootStyle } = makeEnv({ width: 300, height: 120 });
  runner.start();
  runner.onMessage({ source: parent, data: renderMessage('<p>x</p>') });
  assert.equal(rootStyle.padding, `${SANDBOX_BLEED}px`, 'bleed is inline padding on the root element');
  // A body background is painted over the whole page unless <html> has a background of its own. An invisible one
  // keeps the bleed transparent; the color is forced too so `html { background: #fff }` cannot fill it.
  assert.deepEqual(rootStyle.props['background-image'], { value: 'linear-gradient(transparent, transparent)', priority: 'important' }, 'html has an invisible background image');
  assert.deepEqual(rootStyle.props['background-color'], { value: 'transparent', priority: 'important' }, 'html color cannot be set by the fragment');
  assert.deepEqual(sizes(posted).map((m) => [m.width, m.height, m.bleed]), [[300, 120 + SANDBOX_BLEED * 2, SANDBOX_BLEED]]);
}

{
  // A picture wider than the frame overflows to its own edge; the padding at the far side must be added back.
  const { runner, posted, parent } = makeEnv({ width: 612, height: 100 });
  runner.start();
  runner.onMessage({ source: parent, data: renderMessage('<p>x</p>') });
  assert.equal(sizes(posted).length, 1);
  const narrow = makeEnv({ width: 612, height: 100 });
  narrow.page.clientWidth = 600;
  narrow.runner.start();
  narrow.runner.onMessage({ source: narrow.parent, data: renderMessage('<p>x</p>') });
  assert.equal(sizes(narrow.posted)[0].width, 612 + SANDBOX_BLEED, 'overflow past the frame gets the far bleed');
  const fits = makeEnv({ width: 600, height: 100 });
  fits.page.clientWidth = 600;
  fits.runner.start();
  fits.runner.onMessage({ source: fits.parent, data: renderMessage('<p>x</p>') });
  assert.equal(sizes(fits.posted)[0].width, 600, 'a picture that fits adds nothing');
}

{
  // Content that really grows after the frame took our size is reported as a real change and keeps the bleed.
  const { runner, posted, parent, page, fire } = makeEnv({ width: 300, height: 100 });
  runner.start();
  runner.onMessage({ source: parent, data: renderMessage('<p>x</p>') });
  const first = sizes(posted)[0];
  page.innerWidth = first.width;
  page.innerHeight = first.height;
  page.bodyHeight = 160;
  fire();
  const all = sizes(posted);
  assert.equal(all.length, 2);
  assert.deepEqual([all[1].height, all[1].bleed], [160 + SANDBOX_BLEED * 2, SANDBOX_BLEED], 'ordinary growth keeps the bleed');
  fire();
  assert.equal(sizes(posted).length, 2, 'an unchanged size is not reported again');
}

{
  // `min-height: 100vh` follows the frame, and the frame follows the report, so the padding would add one more
  // 2 * bleed forever. The runner sees the frame already has its size and drops the bleed instead.
  const { runner, posted, parent, page, rootStyle, fire } = makeEnv({ width: 300, height: 800 });
  runner.start();
  runner.onMessage({ source: parent, data: renderMessage('<p>x</p>') });
  const first = sizes(posted)[0];
  assert.equal(first.height, 800 + SANDBOX_BLEED * 2);
  page.innerWidth = first.width;
  page.innerHeight = first.height;
  page.bodyHeight = first.height;
  fire();
  const all = sizes(posted);
  assert.equal(all.length, 2, 'one more report, not an endless chain');
  assert.deepEqual([all[1].width, all[1].height, all[1].bleed], [300, first.height, 0], 'bleed is dropped and the page fits the frame');
  assert.equal(rootStyle.padding, '0', 'the padding is removed with it');
  assert.deepEqual(rootStyle.props, {}, 'the invisible background goes with the bleed, so the page behaves as it did before the bleed');
  page.innerHeight = all[1].height;
  fire();
  fire();
  assert.equal(sizes(posted).length, 2, 'settled: the viewport-sized page stays put');
}

{
  // The same for `width: 100vw`.
  const { runner, posted, parent, page, fire } = makeEnv({ width: 400, height: 100 });
  runner.start();
  runner.onMessage({ source: parent, data: renderMessage('<p>x</p>') });
  const first = sizes(posted)[0];
  page.innerWidth = first.width;
  page.innerHeight = first.height;
  page.clientWidth = first.width;
  page.scrollWidth = first.width + SANDBOX_BLEED;
  fire();
  const all = sizes(posted);
  assert.equal(all.length, 2);
  assert.equal(all[1].bleed, 0, 'a viewport-wide page loses the bleed too');
}

const RING = { color: '#db4c84', width: 2, offset: 2 };
const picked = (posted) => posted.filter((p) => p.msg.type === SANDBOX_MSG.PICKED).map((p) => p.msg);
const mountedEnv = () => {
  const env = makeEnv();
  env.runner.start();
  env.runner.onMessage({ source: env.parent, data: renderMessage('<p>x</p>') });
  return env;
};

{
  // Pick: the first stamped element from the top of the stack down, so a transparent layer over the text does not hide it.
  const { runner, posted, parent, stack } = mountedEnv();
  const title = fakeElement('1.0', null);
  const overlay = fakeElement(null, null);
  const lineBreak = fakeElement(null, title);
  stack.list = [overlay, lineBreak, title];
  runner.onMessage({ source: parent, data: pickMessage('p1', 40, 30) });
  assert.deepEqual(stack.asked, [[40, 30]], 'the point goes to elementsFromPoint unchanged');
  assert.deepEqual(picked(posted), [{ type: SANDBOX_MSG.PICKED, id: 'p1', target: '1.0' }], 'a <br> inside the text finds the text');
  stack.list = [overlay, fakeElement('2', null), title];
  runner.onMessage({ source: parent, data: pickMessage('p2', 1, 1) });
  assert.equal(picked(posted)[1].target, '2', 'the topmost stamped element wins');
  stack.list = [overlay, fakeElement(null, null)];
  runner.onMessage({ source: parent, data: pickMessage('p3', 1, 1) });
  assert.equal(picked(posted)[2].target, null, 'nothing stamped under the point is no hit');
  stack.list = [fakeElement('1" x', null)];
  runner.onMessage({ source: parent, data: pickMessage('p4', 1, 1) });
  assert.equal(picked(posted)[3].target, null, 'an id a fragment forged is not passed on');
  stack.list = [null, {}, title];
  runner.onMessage({ source: parent, data: pickMessage('p5', 1, 1) });
  assert.equal(picked(posted)[4].target, '1.0', 'entries that cannot be searched are skipped');
}

{
  // Messages before render, from another window, or malformed do nothing.
  const env = makeEnv();
  env.runner.start();
  env.runner.onMessage({ source: env.parent, data: pickMessage('p1', 1, 1) });
  env.runner.onMessage({ source: env.parent, data: selectMessage('1.0', RING) });
  env.runner.onMessage({ source: env.parent, data: textMessage('1.0', 'x') });
  env.runner.onMessage({ source: env.parent, data: renderMessage('<p>x</p>') });
  env.runner.onMessage({ source: {}, data: pickMessage('p2', 1, 1) });
  env.runner.onMessage({ source: env.parent, data: pickMessage('p3', NaN, 1) });
  assert.deepEqual(picked(env.posted), [], 'nothing answered');
  assert.equal(env.stack.asked.length, 0);
  assert.equal(env.head.kids.length, 0, 'no ring rule was written');
}

{
  // Select: one marker attribute on the element and one injected rule. The fragment's own markup is not touched.
  const { runner, parent, byTarget, head } = mountedEnv();
  byTarget['1.0'] = fakeElement('1.0', null);
  byTarget['2'] = fakeElement('2', null);
  runner.onMessage({ source: parent, data: selectMessage('1.0', RING) });
  assert.equal('data-lulu-selected' in byTarget['1.0'].attrs, true, 'the element carries the marker');
  assert.equal(head.kids.length, 1, 'one rule in the head');
  const rule = head.kids[0].textContent;
  assert.match(rule, /\[data-lulu-selected\]\[data-lulu-selected\]/, 'the doubled attribute outranks a rule of the fragment');
  assert.match(rule, /outline:2px solid #db4c84 !important/);
  assert.match(rule, /outline-offset:2px !important/);
  runner.onMessage({ source: parent, data: selectMessage('2', { color: '#112233', width: 3, offset: 4 }) });
  assert.equal('data-lulu-selected' in byTarget['1.0'].attrs, false, 'the marker moves');
  assert.equal('data-lulu-selected' in byTarget['2'].attrs, true);
  assert.equal(head.kids.length, 1, 'the same rule is rewritten, not stacked');
  assert.match(head.kids[0].textContent, /outline:3px solid #112233 !important;outline-offset:4px !important/, 'the look comes with the message');
  runner.onMessage({ source: parent, data: selectMessage('9.9', RING) });
  assert.equal('data-lulu-selected' in byTarget['2'].attrs, false, 'a target that is not there clears the old one');
  runner.onMessage({ source: parent, data: selectMessage('1.0', RING) });
  runner.onMessage({ source: parent, data: selectMessage(null, null) });
  assert.equal('data-lulu-selected' in byTarget['1.0'].attrs, false, 'null clears');
  runner.onMessage({ source: parent, data: selectMessage('1.0', RING) });
  runner.onMessage({ source: parent, data: selectMessage('1.0', { color: 'red', width: 2, offset: 2 }) });
  assert.equal('data-lulu-selected' in byTarget['1.0'].attrs, true, 'an invalid ring is not a message, so the selection stays');
}

{
  // Text: built from text nodes and <br> only, so it can never become markup. The size is reported again.
  const { runner, posted, parent, byTarget, page } = mountedEnv();
  byTarget['1.0'] = fakeElement('1.0', null);
  page.bodyHeight = 200;
  runner.onMessage({ source: parent, data: textMessage('1.0', 'New\n<b>Title</b>\r\n') });
  const kids = byTarget['1.0'].kids;
  assert.deepEqual(kids.map((k) => (k.text !== undefined ? k.text : 'br')), ['New', 'br', '<b>Title</b>', 'br'], 'a text node per line, a <br> between');
  assert.equal(sizes(posted).at(-1).height, 200 + SANDBOX_BLEED * 2, 'the frame follows the new height');
  runner.onMessage({ source: parent, data: textMessage('1.0', '') });
  assert.deepEqual(byTarget['1.0'].kids, [], 'empty text empties the element');
  const before = posted.length;
  runner.onMessage({ source: parent, data: textMessage('9.9', 'x') });
  assert.equal(posted.length, before, 'a target that is not there is ignored');
  runner.onMessage({ source: {}, data: textMessage('1.0', 'forged') });
  assert.deepEqual(byTarget['1.0'].kids, [], 'another window cannot edit');
}

{
  // The ring is for the screen: export takes it off while it captures, and puts it back after.
  const seen = [];
  let selectedEl = null;
  const env = makeEnv({
    toCanvas: async () => {
      seen.push('data-lulu-selected' in selectedEl.attrs);
      env.runner.onMessage({ source: env.parent, data: selectMessage('1.0', RING) });
      seen.push('data-lulu-selected' in selectedEl.attrs);
      return { width: 600, height: 240 };
    },
  });
  env.runner.start();
  env.runner.onMessage({ source: env.parent, data: renderMessage('<p>x</p>') });
  selectedEl = fakeElement('1.0', null);
  env.byTarget['1.0'] = selectedEl;
  env.runner.onMessage({ source: env.parent, data: selectMessage('1.0', RING) });
  assert.equal('data-lulu-selected' in selectedEl.attrs, true);
  env.runner.onMessage({ source: env.parent, data: captureMessage('c9', 1) });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen, [false, false], 'the picture is taken without the ring, even if a select arrives meanwhile');
  assert.equal('data-lulu-selected' in selectedEl.attrs, true, 'the ring is back when the capture is over');
  assert.equal(env.posted.some((p) => p.msg.type === SANDBOX_MSG.CAPTURED), true);
}

{
  // A failed capture puts the ring back too.
  const env = makeEnv({ toCanvas: async () => { throw new Error('boom'); } });
  env.runner.start();
  env.runner.onMessage({ source: env.parent, data: renderMessage('<p>x</p>') });
  const el = fakeElement('1.0', null);
  env.byTarget['1.0'] = el;
  env.runner.onMessage({ source: env.parent, data: selectMessage('1.0', RING) });
  env.runner.onMessage({ source: env.parent, data: captureMessage('c8', 1) });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal('data-lulu-selected' in el.attrs, true, 'the ring comes back after a failed capture');
}

console.log('ok sandbox runner');
