/* Runner page logic. Mounts one Sketch fragment, reports its size, and captures it on request.
 * Everything the page touches is injected, so Node tests drive it with a fake window.
 * Fragment scripts run in this same document and are untrusted: they can lie about size or
 * send junk, so Board validates every message. Nothing here holds a secret. */
import {
  parseRender,
  parseAppearance,
  parseCapture,
  parsePick,
  parseSelect,
  parseText,
  readyMessage,
  sizeMessage,
  capturedMessage,
  errorMessage,
  pickedMessage,
  splitSketchText,
  SANDBOX_BLEED,
  SANDBOX_TARGET_ATTR,
  SANDBOX_SELECTED_ATTR,
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
  // The element Board selected, the rule that paints its ring, and how many captures are running right now.
  var selected = null;
  var ringStyle = null;
  var capturing = 0;

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

  function mount(html, appearance) {
    var root = doc.documentElement;
    if (root) {
      var data = root.dataset || (root.dataset = {});
      data.appearance = appearance === 'dark' ? 'dark' : 'light';
    }
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

  function markSelected(on) {
    if (!selected) return;
    if (on) selected.setAttribute(SANDBOX_SELECTED_ATTR, '');
    else selected.removeAttribute(SANDBOX_SELECTED_ATTR);
  }

  function findTarget(target) {
    // The target is a validated element-index path, so it is safe inside a selector.
    return doc.querySelector('[' + SANDBOX_TARGET_ATTR + '="' + target + '"]');
  }

  /* The ring is an outline from one injected rule that keys on the marker attribute. It sits where the browser
   * put the element, follows its transforms, and leaves the fragment's own markup and styles alone. The doubled
   * attribute outranks a fragment rule of its own that also says !important. */
  function writeRing(ring) {
    if (!ringStyle) {
      ringStyle = doc.createElement('style');
      (doc.head || doc.documentElement).appendChild(ringStyle);
    }
    var attr = '[' + SANDBOX_SELECTED_ATTR + ']';
    ringStyle.textContent = 'html ' + attr + attr + '{outline:' + ring.width + 'px solid ' + ring.color
      + ' !important;outline-offset:' + ring.offset + 'px !important}';
  }

  function select(request) {
    markSelected(false);
    selected = request.target ? findTarget(request.target) : null;
    if (!selected) return;
    writeRing(request.ring);
    if (!capturing) markSelected(true);
  }

  /* The first piece of text, from the top of the stack down, that Board stamped. Going down the stack lets a
   * transparent layer over the text still let the text be picked. */
  function pick(request) {
    var stack = typeof doc.elementsFromPoint === 'function' ? doc.elementsFromPoint(request.x, request.y) : [];
    var target = null;
    for (var i = 0; i < stack.length && !target; i += 1) {
      var host = stack[i] && typeof stack[i].closest === 'function' ? stack[i].closest('[' + SANDBOX_TARGET_ATTR + ']') : null;
      if (host) target = host.getAttribute(SANDBOX_TARGET_ATTR);
    }
    post(pickedMessage(request.id, target));
  }

  /* Only text nodes and <br> are built, so the text can never become markup. */
  function writeText(request) {
    var el = findTarget(request.target);
    if (!el) return;
    var fragment = doc.createDocumentFragment();
    splitSketchText(request.text).forEach(function (line, index) {
      if (index) fragment.appendChild(doc.createElement('br'));
      if (line) fragment.appendChild(doc.createTextNode(line));
    });
    el.replaceChildren(fragment);
    reportSize();
  }

  async function capture(request) {
    // The ring is for the screen. The picture that leaves Board must not carry it.
    capturing += 1;
    markSelected(false);
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
    } finally {
      capturing -= 1;
      if (!capturing) markSelected(true);
    }
  }

  function applyAppearance(appearance) {
    var root = doc.documentElement;
    if (!root) return;
    var data = root.dataset || (root.dataset = {});
    data.appearance = appearance;
    var Ctor = win.Event;
    if (!doc.dispatchEvent || typeof Ctor !== 'function') return;
    doc.dispatchEvent(new Ctor('lulu-appearance'));
  }

  function onMessage(event) {
    if (event.source !== win.parent) return;
    var render = parseRender(event.data);
    if (render) {
      // One render per runner load: Board mounts a fresh frame for every sketch.
      if (rendered) return;
      rendered = true;
      mount(render.html, render.appearance);
      return;
    }
    var theme = parseAppearance(event.data);
    if (theme) {
      if (!rendered) return;
      applyAppearance(theme.appearance);
      return;
    }
    var request = parseCapture(event.data);
    if (request) {
      capture(request);
      return;
    }
    // Everything below acts on the mounted fragment.
    if (!rendered) return;
    var probe = parsePick(event.data);
    if (probe) {
      pick(probe);
      return;
    }
    var choice = parseSelect(event.data);
    if (choice) {
      select(choice);
      return;
    }
    var edit = parseText(event.data);
    if (edit) writeText(edit);
  }

  /* A click on a link would navigate this frame away from the sketch, and Present mode lets clicks reach it.
   * preventDefault only: the event keeps running, so the fragment's own click handlers still fire.
   * Click events only: a script can still set location.href, so this guards the picture, not the sandbox. */
  function blockLinkClick(event) {
    var target = event.target;
    if (target && typeof target.closest === 'function' && target.closest('a[*|href], area[href]')) {
      event.preventDefault();
    }
  }

  function start() {
    win.addEventListener('message', onMessage);
    // Capture phase on the window, registered before any fragment mounts, so it runs ahead of fragment listeners.
    win.addEventListener('click', blockLinkClick, true);
    post(readyMessage());
  }

  return { start: start, onMessage: onMessage, blockLinkClick: blockLinkClick };
}
