/* Runner page logic. Mounts one Sketch fragment, reports its size, and captures it on request.
 * Everything the page touches is injected, so Node tests drive it with a fake window.
 * Fragment scripts run in this same document and are untrusted: they can lie about size or
 * send junk, so Board validates every message. Nothing here holds a secret. */
import {
  parseRender,
  parseCapture,
  readyMessage,
  sizeMessage,
  capturedMessage,
  errorMessage,
  SANDBOX_BLEED,
} from './protocol.js';

export function createRunner(env) {
  var win = env.window;
  var doc = env.document;
  var toCanvas = env.toCanvas;
  var rendered = false;
  var lastW = 0;
  var lastH = 0;
  var bleed = SANDBOX_BLEED;
  var lastBleed = -1;

  function post(message, transfer) {
    // The runner has an opaque origin and cannot name its parent's origin; frame-ancestors decides who may embed it.
    win.parent.postMessage(message, '*', transfer || []);
  }

  /* The bleed is padding on <html>, set inline so a fragment's own reset (`* { padding: 0 }`,
   * `html { padding: 0 }`) cannot remove it, and so the fragment's `body` rules keep their meaning.
   * It must also stay transparent. The browser paints a page's `body { background }` over the whole page unless
   * <html> has a background of its own, which would color the bleed. So <html> gets an invisible background
   * image, and its color is forced transparent so `html { background: #fff }` cannot fill the bleed either.
   * The fragment's background then covers the picture only. */
  function setBleed(px) {
    bleed = px;
    var style = doc.documentElement && doc.documentElement.style;
    if (!style) return;
    style.padding = px ? px + 'px' : '0';
    if (px) {
      style.setProperty('background-color', 'transparent', 'important');
      style.setProperty('background-image', 'linear-gradient(transparent, transparent)', 'important');
    } else {
      style.removeProperty('background-color');
      style.removeProperty('background-image');
    }
  }

  /* The frame is the picture plus the bleed on every side. Returns the whole frame size. */
  function measure() {
    var root = doc.documentElement;
    var body = doc.body;
    if (!root || !body) return null;
    var rect = body.getBoundingClientRect();
    var top = rect.top || 0;
    var bottom = rect.bottom != null ? rect.bottom : top + rect.height;
    // A picture wider than the frame overflows to its own edge, and the padding at the far side is not part of
    // that overflow, so put it back. A narrower picture fills the frame and needs nothing.
    var wide = root.scrollWidth > root.clientWidth;
    var w = Math.ceil(root.scrollWidth) + (wide ? bleed : 0);
    var h = Math.ceil(Math.max(bottom, top + body.scrollHeight)) + bleed;
    return w > 0 && h > 0 ? { width: w, height: h } : null;
  }

  /* A fragment sized by the viewport (`min-height: 100vh`, `width: 100vw`) follows the frame, and the frame
   * follows the report, so the bleed padding would add one more 2 * bleed on every round and never settle.
   * The tell: the frame already has our last size, yet the page asks for exactly 2 * bleed more. Such a
   * fragment gets no bleed, which is how every Sketch behaved before the bleed existed. */
  function followsViewport(size) {
    if (bleed === 0 || lastW === 0) return false;
    return (win.innerWidth === lastW && size.width === lastW + 2 * bleed)
      || (win.innerHeight === lastH && size.height === lastH + 2 * bleed);
  }

  function reportSize() {
    var size = measure();
    if (size && followsViewport(size)) {
      setBleed(0);
      size = measure();
    }
    if (!size || (size.width === lastW && size.height === lastH && bleed === lastBleed)) return;
    lastW = size.width;
    lastH = size.height;
    lastBleed = bleed;
    post(sizeMessage(size.width, size.height, bleed));
  }

  function mount(html) {
    var body = doc.body;
    setBleed(SANDBOX_BLEED);
    var range = doc.createRange();
    range.selectNodeContents(body);
    // createContextualFragment keeps scripts runnable on insertion, unlike innerHTML.
    body.appendChild(range.createContextualFragment(html));
    reportSize();
    if (typeof env.ResizeObserver === 'function') {
      var observer = new env.ResizeObserver(reportSize);
      observer.observe(doc.documentElement);
      observer.observe(body);
    }
    // Late images and fonts change the height without resizing an observed box in some engines.
    body.addEventListener('load', reportSize, true);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(reportSize);
  }

  async function capture(request) {
    try {
      if (!rendered) throw new Error('nothing rendered');
      if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
      var canvas = await toCanvas(doc.documentElement, {
        backgroundColor: null,
        dpr: 1,
        scale: request.scale,
      });
      var bitmap = await env.createImageBitmap(canvas);
      post(capturedMessage(request.id, bitmap), [bitmap]);
    } catch (err) {
      post(errorMessage(request.id, err && err.message));
    }
  }

  function onMessage(event) {
    if (event.source !== win.parent) return;
    var render = parseRender(event.data);
    if (render) {
      // One render per runner load: Board mounts a fresh frame for every sketch.
      if (rendered) return;
      rendered = true;
      mount(render.html);
      return;
    }
    var request = parseCapture(event.data);
    if (request) capture(request);
  }

  function start() {
    win.addEventListener('message', onMessage);
    post(readyMessage());
  }

  return { start: start, onMessage: onMessage };
}
