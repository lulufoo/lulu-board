/* postMessage contract between Board (parent) and the sandbox runner page.
 * Pure data and validators: no DOM, so Board, the runner, and Node tests share one source.
 * The runner is an opaque-origin document, so every receiver must treat message data as untrusted. */

export const SANDBOX_MSG = Object.freeze({
  READY: 'lulu-sandbox:ready',
  RENDER: 'lulu-sandbox:render',
  SIZE: 'lulu-sandbox:size',
  CAPTURE: 'lulu-sandbox:capture',
  CAPTURED: 'lulu-sandbox:captured',
  ERROR: 'lulu-sandbox:error',
});

/* Largest edge, in CSS px, the runner may report. Larger values are dropped, not clamped. */
export const SANDBOX_MAX_EDGE = 32768;
export const SANDBOX_MAX_SCALE = 8;
export const SANDBOX_MAX_ID_LENGTH = 64;

/* Transparent room, in CSS px, the runner keeps on every side of a Sketch. A shadow, outline, or ring that spills
 * past the picture is still drawn inside it; anything farther out is cut by the frame. */
export const SANDBOX_BLEED = 12;

function isObject(data) {
  return data !== null && typeof data === 'object';
}

function validEdge(n) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= SANDBOX_MAX_EDGE;
}

function validId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= SANDBOX_MAX_ID_LENGTH;
}

/* Board -> runner */

export function renderMessage(html) {
  return { type: SANDBOX_MSG.RENDER, html: String(html == null ? '' : html) };
}

export function captureMessage(id, scale) {
  return { type: SANDBOX_MSG.CAPTURE, id: id, scale: scale };
}

export function parseRender(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.RENDER || typeof data.html !== 'string') return null;
  return { html: data.html };
}

export function parseCapture(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.CAPTURE || !validId(data.id)) return null;
  var scale = data.scale;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0 || scale > SANDBOX_MAX_SCALE) return null;
  return { id: data.id, scale: scale };
}

/* Runner -> Board */

export function readyMessage() {
  return { type: SANDBOX_MSG.READY };
}

/* width and height are the whole frame. bleed is the room on each side inside them, so the picture is
 * (width - 2 * bleed) by (height - 2 * bleed). A runner that sends no bleed is a frame that is the picture. */
export function sizeMessage(width, height, bleed) {
  return { type: SANDBOX_MSG.SIZE, width: width, height: height, bleed: bleed || 0 };
}

export function capturedMessage(id, bitmap) {
  return { type: SANDBOX_MSG.CAPTURED, id: id, bitmap: bitmap };
}

export function errorMessage(id, message) {
  return { type: SANDBOX_MSG.ERROR, id: id, message: String(message || 'error').slice(0, 200) };
}

export function parseReady(data) {
  return isObject(data) && data.type === SANDBOX_MSG.READY ? {} : null;
}

/* The bleed is untrusted too: anything but a whole-pixel room of at most SANDBOX_BLEED that still leaves a
 * picture inside the frame is dropped to 0, which is the old frame-is-the-picture behavior. */
function validBleed(bleed, width, height) {
  return typeof bleed === 'number' && Number.isInteger(bleed) && bleed > 0 && bleed <= SANDBOX_BLEED
    && width > bleed * 2 && height > bleed * 2;
}

export function parseSize(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.SIZE) return null;
  if (!validEdge(data.width) || !validEdge(data.height)) return null;
  var width = Math.ceil(data.width);
  var height = Math.ceil(data.height);
  return { width: width, height: height, bleed: validBleed(data.bleed, width, height) ? data.bleed : 0 };
}

/* The bitmap is only duck-typed here: ImageBitmap does not exist in Node. */
export function parseCaptured(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.CAPTURED || !validId(data.id)) return null;
  var bitmap = data.bitmap;
  if (!isObject(bitmap) || !validEdge(bitmap.width) || !validEdge(bitmap.height)) return null;
  return { id: data.id, bitmap: bitmap };
}

export function parseError(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.ERROR) return null;
  return {
    id: validId(data.id) ? data.id : null,
    message: typeof data.message === 'string' ? data.message.slice(0, 200) : 'error',
  };
}
