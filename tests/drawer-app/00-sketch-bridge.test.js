import assert from 'node:assert/strict';
import {
  openSketchChannel,
  getSketchChannel,
  sketchFramePoint,
  pickSketch,
  settleSketchPick,
  failSketchPicks,
  markSketch,
  patchSketchText,
} from '../../packages/drawer-app/src/kinds/sketch-bridge.js';
import { SANDBOX_MSG, parsePick, parseSelect, parseText } from '../../packages/sandbox-app/src/protocol.js';

// A frame as the bridge sees it: connected, a window to post to, and the picture around it that has the camera's scale.
function makeFrame({ rect = { left: 100, top: 50, width: 600, height: 300 }, layoutWidth = 300, connected = true } = {}) {
  const sent = [];
  const frame = {
    isConnected: connected,
    contentWindow: { postMessage: (msg, target) => sent.push({ msg, target }) },
    parentElement: { getBoundingClientRect: () => rect, offsetWidth: layoutWidth },
  };
  return { frame, sent };
}

// The screen point to the frame point: zoom is drawn width over layout width; the frame hangs `bleed` out.
{
  const rect = { left: 100, top: 50, width: 600, height: 300 };
  assert.deepEqual(sketchFramePoint(rect, 300, 0, 100, 50), { x: 0, y: 0 }, 'the picture corner, no bleed');
  assert.deepEqual(sketchFramePoint(rect, 300, 0, 400, 200), { x: 150, y: 75 }, 'zoom 2: 300 screen px is 150 css px');
  assert.deepEqual(sketchFramePoint(rect, 300, 12, 400, 200), { x: 162, y: 87 }, 'the frame starts bleed px before the picture');
  assert.deepEqual(sketchFramePoint(rect, 300, 12, 100, 50), { x: 12, y: 12 });
  assert.deepEqual(sketchFramePoint({ left: 0, top: 0, width: 150, height: 75 }, 300, 0, 75, 30), { x: 150, y: 60 }, 'zoom 0.5');
  assert.deepEqual(sketchFramePoint(rect, 300, 12, 94, 44), { x: 9, y: 9 }, 'inside the bleed ring, left of the picture');
  assert.equal(sketchFramePoint(rect, 300, 12, 70, 200), null, 'beyond the bleed on the left');
  assert.equal(sketchFramePoint(rect, 300, 12, 400, 20), null, 'beyond the bleed on the top');
  assert.equal(sketchFramePoint(rect, 300, 12, 740, 200), null, 'beyond the bleed on the right');
  assert.equal(sketchFramePoint(rect, 300, 12, 400, 380), null, 'beyond the bleed on the bottom');
  assert.deepEqual(sketchFramePoint(rect, 300, 12, 700, 350), { x: 312, y: 162 }, 'the far corner of the picture, still inside');
  for (const bad of [null, undefined, { left: 0, top: 0, width: 0, height: 10 }, { left: 0, top: 0, width: NaN, height: 10 }]) {
    assert.equal(sketchFramePoint(bad, 300, 0, 1, 1), null);
  }
  assert.equal(sketchFramePoint(rect, 0, 0, 1, 1), null, 'no layout width, no zoom');
  assert.equal(sketchFramePoint(rect, NaN, 0, 1, 1), null);
}

// Channels: one per frame, found again by the same frame, and an unknown frame has none.
{
  const { frame } = makeFrame();
  assert.equal(getSketchChannel(frame), null);
  assert.equal(getSketchChannel(null), null);
  const channel = openSketchChannel(frame);
  assert.equal(channel.bleed, 0);
  assert.equal(channel.pending instanceof Map && channel.picks instanceof Map, true);
  assert.equal(getSketchChannel(frame), channel);
  assert.equal(getSketchChannel(makeFrame().frame), null, 'another frame is another channel');
  assert.notEqual(openSketchChannel(frame), channel, 'opening again replaces the channel');
}

// Timers are driven by hand so the 1.5 s wait does not slow the suite.
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const timers = new Map();
let timerSeq = 0;
globalThis.setTimeout = (fn, ms) => { timerSeq += 1; timers.set(timerSeq, { fn, ms }); return timerSeq; };
globalThis.clearTimeout = (id) => { timers.delete(id); };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

try {
  // A pick posts one message with the frame point and resolves with the runner's answer.
  {
    const { frame, sent } = makeFrame();
    const channel = openSketchChannel(frame);
    channel.bleed = 12;
    const promise = pickSketch(frame, 400, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].target, '*', 'the runner is another origin');
    const request = parsePick(sent[0].msg);
    assert.deepEqual([request.x, request.y], [162, 87], 'the point is moved into the frame');
    assert.equal(channel.picks.size, 1);
    assert.equal([...timers.values()].at(-1).ms, 1500, 'a runner that never answers is waited for 1.5 s');
    settleSketchPick(channel, request.id, '1.0');
    assert.equal(await promise, '1.0');
    assert.equal(channel.picks.size, 0, 'the request is done');
    assert.equal(timers.size, 0, 'and its timer with it');
    settleSketchPick(channel, request.id, '2');
    settleSketchPick(channel, 'never-asked', '2');
  }

  // No answer in time: the click counts as blank.
  {
    const { frame } = makeFrame();
    const channel = openSketchChannel(frame);
    const promise = pickSketch(frame, 400, 200);
    const [timerId, timer] = [...timers.entries()].at(-1);
    timers.delete(timerId);
    timer.fn();
    assert.equal(await promise, null);
    assert.equal(channel.picks.size, 0);
  }

  // Request ids do not repeat, so a late answer cannot settle a newer click.
  {
    const { frame, sent } = makeFrame();
    const channel = openSketchChannel(frame);
    const first = pickSketch(frame, 400, 200);
    const second = pickSketch(frame, 400, 200);
    const [a, b] = sent.map((s) => parsePick(s.msg).id);
    assert.notEqual(a, b);
    settleSketchPick(channel, b, '2');
    assert.equal(await second, '2');
    assert.equal(channel.picks.size, 1, 'the first is still waiting');
    failSketchPicks(channel);
    assert.equal(await first, null, 'a replaced frame fails what is waiting');
    assert.equal(channel.picks.size, 0);
    assert.equal(timers.size, 0, 'no timer is left behind');
  }

  // Nothing to ask: no channel, a point beyond the frame, a frame that is gone, a frame without a window.
  {
    const { frame, sent } = makeFrame();
    assert.equal(await pickSketch(frame, 400, 200), null, 'no channel');
    openSketchChannel(frame);
    assert.equal(await pickSketch(frame, 5000, 200), null, 'beyond the frame');
    const gone = makeFrame({ connected: false });
    openSketchChannel(gone.frame);
    assert.equal(await pickSketch(gone.frame, 400, 200), null, 'a frame that left the page');
    const noWindow = makeFrame();
    noWindow.frame.contentWindow = null;
    openSketchChannel(noWindow.frame);
    assert.equal(await pickSketch(noWindow.frame, 400, 200), null, 'a frame with no window');
    assert.equal(await pickSketch(null, 1, 1), null);
    const loose = makeFrame();
    loose.frame.parentElement = null;
    openSketchChannel(loose.frame);
    assert.equal(await pickSketch(loose.frame, 400, 200), null, 'a frame with no picture around it');
    assert.equal(sent.length + gone.sent.length + noWindow.sent.length + loose.sent.length, 0, 'nothing was posted');
    assert.equal(timers.size, 0);
  }
  await flush();
} finally {
  globalThis.setTimeout = realSetTimeout;
  globalThis.clearTimeout = realClearTimeout;
}

// Select: the ring is Board's own constant and travels with the message.
{
  const { frame, sent } = makeFrame();
  markSketch(frame, '1.0');
  assert.deepEqual(parseSelect(sent[0].msg), { target: '1.0', ring: { color: '#db4c84', width: 2, offset: 2 } });
  assert.equal(sent[0].target, '*');
  markSketch(frame, null);
  assert.deepEqual(parseSelect(sent[1].msg), { target: null, ring: null }, 'clearing sends no ring');
  markSketch(frame, '');
  assert.deepEqual(parseSelect(sent[2].msg), { target: null, ring: null }, 'an empty id clears too');
  markSketch(null, '1.0');
  markSketch(makeFrame({ connected: false }).frame, '1.0');
  assert.equal(sent.length, 3, 'a missing or detached frame is skipped without error');
}

// Text: one message, the target and the text as typed.
{
  const { frame, sent } = makeFrame();
  patchSketchText(frame, '1.0', 'A\nB');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].msg.type, SANDBOX_MSG.TEXT);
  assert.deepEqual(parseText(sent[0].msg), { target: '1.0', text: 'A\nB' });
  patchSketchText(null, '1.0', 'x');
  const detached = makeFrame({ connected: false });
  patchSketchText(detached.frame, '1.0', 'x');
  assert.equal(detached.sent.length, 0, 'a detached frame is skipped');
}

console.log('ok sketch bridge');
