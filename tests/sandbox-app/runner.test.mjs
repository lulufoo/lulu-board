import assert from 'node:assert/strict';
import { createRunner } from '../../packages/sandbox-app/src/runner.js';
import { SANDBOX_MSG, SANDBOX_BLEED, renderMessage, captureMessage } from '../../packages/sandbox-app/src/protocol.js';

/* A fake window. `page` is the layout the runner reads and may be changed between reports; `fire()` runs the
 * ResizeObserver callback, which is what a layout change does in a browser. */
function makeEnv({ width = 300, height = 120, toCanvas } = {}) {
  const posted = [];
  const listeners = {};
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
    appendChild: (node) => mounted.push(node),
    addEventListener: () => {},
  };
  const doc = {
    documentElement: {
      get scrollWidth() { return page.scrollWidth; },
      get clientWidth() { return page.clientWidth; },
      style: rootStyle,
    },
    body,
    createRange: () => ({ selectNodeContents() {}, createContextualFragment: (html) => ({ html }) }),
  };
  const win = {
    parent,
    get innerWidth() { return page.innerWidth; },
    get innerHeight() { return page.innerHeight; },
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  let observe = null;
  const runner = createRunner({
    window: win,
    document: doc,
    toCanvas: toCanvas || (async () => ({ width: 600, height: 240 })),
    createImageBitmap: async (canvas) => ({ width: canvas.width, height: canvas.height }),
    ResizeObserver: function (cb) { observe = cb; this.observe = () => {}; },
  });
  return { runner, posted, listeners, parent, mounted, win, page, rootStyle, fire: () => observe() };
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
  const { runner, posted, parent, mounted } = makeEnv();
  runner.start();
  runner.onMessage({ source: {}, data: renderMessage('<p>evil</p>') });
  assert.equal(mounted.length, 0, 'messages from other windows are ignored');
  runner.onMessage({ source: parent, data: renderMessage('<p>ok</p>') });
  assert.deepEqual(mounted, [{ html: '<p>ok</p>' }]);
  const size = posted.find((p) => p.msg.type === SANDBOX_MSG.SIZE);
  assert.deepEqual(size.msg, { type: SANDBOX_MSG.SIZE, width: 300, height: 120 + SANDBOX_BLEED * 2, bleed: SANDBOX_BLEED },
    'the frame is the picture plus the bleed, and the message says how much');
  runner.onMessage({ source: parent, data: renderMessage('<p>second</p>') });
  assert.equal(mounted.length, 1, 'a runner renders once');
  assert.equal(posted.filter((p) => p.msg.type === SANDBOX_MSG.SIZE).length, 1, 'size is sent when it changes');
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

console.log('ok sandbox runner');
