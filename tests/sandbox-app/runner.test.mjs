import assert from 'node:assert/strict';
import { createRunner } from '../../packages/sandbox-app/src/runner.js';
import { SANDBOX_MSG, renderMessage, captureMessage } from '../../packages/sandbox-app/src/protocol.js';

function makeEnv({ width = 300, height = 120, toCanvas } = {}) {
  const posted = [];
  const listeners = {};
  const mounted = [];
  const parent = { postMessage: (msg, target, transfer) => posted.push({ msg, target, transfer }) };
  const body = {
    scrollHeight: height,
    getBoundingClientRect: () => ({ height }),
    appendChild: (node) => mounted.push(node),
    addEventListener: () => {},
  };
  const doc = {
    documentElement: { scrollWidth: width },
    body,
    createRange: () => ({ selectNodeContents() {}, createContextualFragment: (html) => ({ html }) }),
  };
  const win = { parent, addEventListener: (type, fn) => { listeners[type] = fn; } };
  const runner = createRunner({
    window: win,
    document: doc,
    toCanvas: toCanvas || (async () => ({ width: 600, height: 240 })),
    createImageBitmap: async (canvas) => ({ width: canvas.width, height: canvas.height }),
    ResizeObserver: undefined,
  });
  return { runner, posted, listeners, parent, mounted, win };
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
  assert.deepEqual(size.msg, { type: SANDBOX_MSG.SIZE, width: 300, height: 120 });
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

console.log('ok sandbox runner');
