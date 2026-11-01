/* Mount a sketch fragment in the sandbox runner frame. Its scripts run there. */
import DrawerStyleLine from '../core/style-line.js';
import { emit, call } from '../core/hooks.js';
import { renderMessage, captureMessage, parseReady, parseSize, parseCaptured, parseError } from '../../../sandbox-app/src/protocol.js';
import {
  previewEl,
  diagramSourceEl,
  setStatus,
  showDiagramError,
} from '../state/shell-state.js';

function sketchWorldBounds(el) {
  if (!el) return null;
  var w = el.offsetWidth;
  var h = el.offsetHeight;
  if (!(w > 0 && h > 0)) return null;
  return { minX: 0, minY: 0, maxX: w, maxY: h, width: w, height: h, cx: w / 2, cy: h / 2 };
}

function sketchFragmentRoot(html) {
  var tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  // Scripts are not filtered here: they are meant to run, inside the runner's opaque origin. This removal is a content
  // guard, not a boundary: a script can still create these elements, and the runner's CSP is what blocks them.
  var banned = tpl.content.querySelectorAll("iframe, object, embed, link");
  for (var i = banned.length - 1; i >= 0; i -= 1) banned[i].remove();
  return tpl.content;
}

function bindWorld(rootEl, boundsFn) {
  call("setWorld", rootEl || null, boundsFn || null);
}

/* The runner is a separate origin that only Board may frame. Its scripts run there, not here. */
export const SKETCH_RUNNER_URL = "https://sandbox.luluboard.app/";
// A runner that never reports a size (offline, blocked, not deployed) must not hold the canvas view forever.
var RUNNER_TIMEOUT_MS = 10000;
// A capture waits for the runner's screenshot; a stuck page must not freeze the export button.
var CAPTURE_TIMEOUT_MS = 30000;
var stopListening = null;
// One channel per sketch frame: the captures it is still waiting for.
var channels = new WeakMap();
var captureSeq = 0;

export function renderSketch(opts) {
  opts = opts || {};
  if (stopListening) {
    stopListening();
    stopListening = null;
  }
  if (!previewEl) {
    emit("finishCanvasView", opts);
    return;
  }
  previewEl.classList.remove("board-preview");
  var fragment = "";
  if (typeof DrawerStyleLine.decodeSketchContent === "function") {
    fragment = DrawerStyleLine.decodeSketchContent(diagramSourceEl ? diagramSourceEl.value : "");
  }
  previewEl.innerHTML = "";
  if (!String(fragment || "").trim()) {
    bindWorld(null, null);
    showDiagramError("Sketch content missing");
    setStatus("Sketch content missing", true);
    emit("finishCanvasView", opts);
    return;
  }
  var holder = document.createElement("div");
  holder.appendChild(sketchFragmentRoot(fragment));
  var html = holder.innerHTML;
  var frame = document.createElement("iframe");
  frame.className = "sketch-frame";
  // allow-scripts without allow-same-origin: the frame gets an opaque origin, so its scripts cannot reach Board's
  // storage, cookies, or DOM. Never add allow-same-origin: on a page that can reach its own sandbox attribute it is
  // an escape.
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("scrolling", "no");
  // Width and height are replaced by the picture size. Until that arrives, a placeholder keeps the frame on screen.
  frame.style.cssText = "display:block;border:0;width:100%;height:800px;background:transparent;pointer-events:none;";
  frame.src = SKETCH_RUNNER_URL;
  var finished = false;
  var timer = 0;
  function finish(failed) {
    if (finished || !frame.isConnected) return;
    finished = true;
    clearTimeout(timer);
    bindWorld(frame, function () { return sketchWorldBounds(frame); });
    if (failed) {
      showDiagramError("Sketch runner did not respond");
      setStatus("Sketch runner did not respond", true);
    } else {
      showDiagramError("");
      setStatus("Sketch rendered · " + new Date().toLocaleTimeString());
    }
    emit("finishCanvasView", opts);
  }
  function applySize(size) {
    // The frame is the picture. The camera then centers that box on the stage, on both axes.
    if (size.width > 0) frame.style.width = size.width + "px";
    if (size.height > 0) frame.style.height = size.height + "px";
  }
  var sent = false;
  var channel = { pending: new Map() };
  channels.set(frame, channel);
  function settle(id) {
    var entry = channel.pending.get(id);
    if (!entry) return null;
    clearTimeout(entry.timer);
    channel.pending.delete(id);
    return entry;
  }
  function failCaptures(message) {
    Array.from(channel.pending.keys()).forEach(function (id) {
      var entry = settle(id);
      if (entry) entry.reject(new Error(message));
    });
  }
  function onMessage(event) {
    // The runner has an opaque origin, so event.origin is the string "null" and proves nothing about who sent it.
    // The sender is the frame we made; every field is untrusted and goes through the protocol parsers.
    if (!frame.isConnected) {
      stop();
      return;
    }
    if (event.source !== frame.contentWindow || event.origin !== "null") return;
    if (parseReady(event.data)) {
      if (sent) return;
      sent = true;
      // An opaque origin cannot be named as a target; only the fragment travels this way.
      frame.contentWindow.postMessage(renderMessage(html), "*");
      return;
    }
    var size = parseSize(event.data);
    if (size) {
      applySize(size);
      finish(false);
      return;
    }
    var captured = parseCaptured(event.data);
    if (captured) {
      var done = settle(captured.id);
      if (done) done.resolve(captured.bitmap);
      return;
    }
    var failure = parseError(event.data);
    if (failure && failure.id) {
      var failed = settle(failure.id);
      if (failed) failed.reject(new Error("Sketch capture failed: " + failure.message));
    }
  }
  function stop() {
    window.removeEventListener("message", onMessage);
    clearTimeout(timer);
    failCaptures("Sketch was replaced before the capture finished");
  }
  window.addEventListener("message", onMessage);
  stopListening = stop;
  timer = setTimeout(function () { finish(true); }, RUNNER_TIMEOUT_MS);
  previewEl.appendChild(frame);
}

/* Ask the runner for a transparent bitmap of the whole sketch document, scale times its CSS size.
 * The bitmap is untrusted pixels from another origin: the caller bounds its size before using it. */
export function captureSketch(frame, scale) {
  var channel = frame && channels.get(frame);
  if (!channel || !frame.isConnected || !frame.contentWindow) {
    return Promise.reject(new Error("Sketch is not ready to export"));
  }
  captureSeq += 1;
  var id = "capture-" + captureSeq;
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      channel.pending.delete(id);
      reject(new Error("Sketch capture timed out"));
    }, CAPTURE_TIMEOUT_MS);
    channel.pending.set(id, { resolve: resolve, reject: reject, timer: timer });
    frame.contentWindow.postMessage(captureMessage(id, scale), "*");
  });
}

const Sketch = {
  renderSketch: renderSketch,
  captureSketch: captureSketch,
  sketchWorldBounds: sketchWorldBounds,
  sketchFragmentRoot: sketchFragmentRoot,
};

export default Sketch;
