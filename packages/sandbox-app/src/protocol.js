/* postMessage contract between Board (parent) and the sandbox runner page.
 * Pure data and validators: no DOM, so Board, the runner, and Node tests share one source.
 * The runner is an opaque-origin document, so every receiver must treat message data as untrusted. */

export const SANDBOX_MSG = Object.freeze({
  READY: 'lulu-sandbox:ready',
  RENDER: 'lulu-sandbox:render',
  APPEARANCE: 'lulu-sandbox:appearance',
  SIZE: 'lulu-sandbox:size',
  CAPTURE: 'lulu-sandbox:capture',
  CAPTURED: 'lulu-sandbox:captured',
  PICK: 'lulu-sandbox:pick',
  PICKED: 'lulu-sandbox:picked',
  SELECT: 'lulu-sandbox:select',
  TEXT: 'lulu-sandbox:text',
  ERROR: 'lulu-sandbox:error',
});

/* Largest edge, in CSS px, the runner may report. Larger values are dropped, not clamped. */
export const SANDBOX_MAX_EDGE = 32768;
export const SANDBOX_MAX_SCALE = 8;
export const SANDBOX_MAX_ID_LENGTH = 64;
/* Longest text one `text` message may carry, in UTF-16 units. */
export const SANDBOX_MAX_TEXT = 100000;
/* Board stamps a target id on each piece of pickable text before it sends the fragment. The runner marks the
 * selected one with the second attribute. Both names live here so the two sides cannot drift. */
export const SANDBOX_TARGET_ATTR = 'data-lulu-id';
export const SANDBOX_SELECTED_ATTR = 'data-lulu-selected';

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

/* Light is the default. Anything else is not a theme the runner can stamp. */
function validAppearance(value) {
  return value === 'dark' ? 'dark' : 'light';
}

/* A target id is an element-index path such as "1.0.3". The runner puts it into a selector, so nothing else passes. */
export function isSketchTarget(target) {
  return typeof target === 'string' && target.length <= SANDBOX_MAX_ID_LENGTH && /^\d{1,6}(?:\.\d{1,6})*$/.test(target);
}

function validPoint(n) {
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= SANDBOX_MAX_EDGE;
}

function validRingPx(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 16;
}

/* The selection ring is data from Board, so the runner never builds CSS from a string it did not check. */
function validRing(ring) {
  if (!isObject(ring) || typeof ring.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(ring.color)) return null;
  if (!validRingPx(ring.width) || !validRingPx(ring.offset)) return null;
  return { color: ring.color, width: ring.width, offset: ring.offset };
}

/* A line break in the text box is a <br> in the picture. */
export function splitSketchText(text) {
  return String(text == null ? '' : text).split(/\r\n|\r|\n/);
}

/* Board -> runner */

export function renderMessage(html, appearance) {
  return {
    type: SANDBOX_MSG.RENDER,
    html: String(html == null ? '' : html),
    appearance: validAppearance(appearance),
  };
}

/* A later theme change. An invalid value is not a message: the runner keeps the theme it has. */
export function appearanceMessage(appearance) {
  return { type: SANDBOX_MSG.APPEARANCE, appearance: appearance };
}

export function parseAppearance(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.APPEARANCE) return null;
  if (data.appearance !== 'light' && data.appearance !== 'dark') return null;
  return { appearance: data.appearance };
}

export function captureMessage(id, scale) {
  return { type: SANDBOX_MSG.CAPTURE, id: id, scale: scale };
}

/* Which piece of text is under this point? x and y are CSS px in the frame, bleed included. */
export function pickMessage(id, x, y) {
  return { type: SANDBOX_MSG.PICK, id: id, x: x, y: y };
}

export function parsePick(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.PICK || !validId(data.id)) return null;
  if (!validPoint(data.x) || !validPoint(data.y)) return null;
  return { id: data.id, x: data.x, y: data.y };
}

/* Mark one piece of text as selected, or none (target null). The ring comes with it: Board owns the look. */
export function selectMessage(target, ring) {
  return { type: SANDBOX_MSG.SELECT, target: target, ring: ring };
}

export function parseSelect(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.SELECT) return null;
  if (data.target === null) return { target: null, ring: null };
  var ring = validRing(data.ring);
  return isSketchTarget(data.target) && ring ? { target: data.target, ring: ring } : null;
}

/* Show new text in a piece of text without mounting again. Lines are separated by \n. */
export function textMessage(target, text) {
  return { type: SANDBOX_MSG.TEXT, target: target, text: text };
}

export function parseText(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.TEXT || !isSketchTarget(data.target)) return null;
  if (typeof data.text !== 'string' || data.text.length > SANDBOX_MAX_TEXT) return null;
  return { target: data.target, text: data.text };
}

export function parseRender(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.RENDER || typeof data.html !== 'string') return null;
  return { html: data.html, appearance: validAppearance(data.appearance) };
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

/* The answer to `pick`: the target id under the point, or null. A fragment script can say anything, so an id that is
 * not a valid target is read as no hit. */
export function pickedMessage(id, target) {
  return { type: SANDBOX_MSG.PICKED, id: id, target: isSketchTarget(target) ? target : null };
}

export function parsePicked(data) {
  if (!isObject(data) || data.type !== SANDBOX_MSG.PICKED || !validId(data.id)) return null;
  return { id: data.id, target: isSketchTarget(data.target) ? data.target : null };
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
