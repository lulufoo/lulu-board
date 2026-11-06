/* Board's end of the Sketch bridge: pick, select, and text messages to the runner, and the per-frame channel that
 * holds the requests still waiting for an answer. sketch.js mounts the frame and owns the lifecycle; this file
 * only talks to a frame that is already there. */
import { ring } from '../../../../board-themes/index.js';
import { pickMessage, selectMessage, textMessage } from '../../../../sandbox-app/src/protocol.js';

// A runner that does not know `pick` (an older deploy) never answers. The click then counts as a click on blank.
var PICK_TIMEOUT_MS = 1500;
var channels = new WeakMap();
var pickSeq = 0;

/* One channel per frame. `pending` holds captures, `picks` holds pick requests, `bleed` is the room the runner
 * keeps around the picture, which the pick needs to turn a canvas point into a frame point. */
export function openSketchChannel(frame) {
  var channel = { pending: new Map(), picks: new Map(), bleed: 0 };
  channels.set(frame, channel);
  return channel;
}

export function getSketchChannel(frame) {
  return (frame && channels.get(frame)) || null;
}

/* A point on the screen as a point in the frame's own CSS px. The picture is scaled by the canvas camera, so the
 * ratio of its drawn width to its layout width is the zoom. The frame hangs `bleed` out of the picture on every
 * side, so the point is moved in by that much. A point beyond the frame is no point (null). */
export function sketchFramePoint(rect, layoutWidth, bleed, clientX, clientY) {
  if (!rect || !(rect.width > 0) || !(layoutWidth > 0)) return null;
  var zoom = rect.width / layoutWidth;
  var x = (clientX - rect.left) / zoom;
  var y = (clientY - rect.top) / zoom;
  var height = rect.height / zoom;
  if (x < -bleed || y < -bleed || x > layoutWidth + bleed || y > height + bleed) return null;
  return { x: x + bleed, y: y + bleed };
}

function frameReady(frame) {
  return !!(frame && frame.isConnected && frame.contentWindow);
}

/* Ask the runner which piece of text is under a screen point. Resolves with a target id or null: no text there,
 * no answer in time, or the frame went away. The id is the runner's word and is checked by the caller. */
export function pickSketch(frame, clientX, clientY) {
  var channel = getSketchChannel(frame);
  var picture = frame && frame.parentElement;
  if (!channel || !picture || !frameReady(frame)) return Promise.resolve(null);
  var point = sketchFramePoint(picture.getBoundingClientRect(), picture.offsetWidth, channel.bleed, clientX, clientY);
  if (!point) return Promise.resolve(null);
  pickSeq += 1;
  var id = 'pick-' + pickSeq;
  return new Promise(function (resolve) {
    var timer = setTimeout(function () {
      channel.picks.delete(id);
      resolve(null);
    }, PICK_TIMEOUT_MS);
    channel.picks.set(id, { resolve: resolve, timer: timer });
    frame.contentWindow.postMessage(pickMessage(id, point.x, point.y), '*');
  });
}

export function settleSketchPick(channel, id, target) {
  var entry = channel.picks.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  channel.picks.delete(id);
  entry.resolve(target);
}

/* The frame is being replaced: every pick still waiting is a click on something that is gone. */
export function failSketchPicks(channel) {
  Array.from(channel.picks.keys()).forEach(function (id) {
    settleSketchPick(channel, id, null);
  });
}

/* Show one piece of text as selected, or none. The ring is Board's theme constant, sent with the message. */
export function markSketch(frame, target) {
  if (!frameReady(frame)) return;
  var look = target ? { color: ring.color, width: ring.width, offset: ring.offset } : null;
  frame.contentWindow.postMessage(selectMessage(target || null, look), '*');
}

/* Show new text in one piece of text. The frame is not mounted again. */
export function patchSketchText(frame, target, text) {
  if (!frameReady(frame)) return;
  frame.contentWindow.postMessage(textMessage(target, text), '*');
}
