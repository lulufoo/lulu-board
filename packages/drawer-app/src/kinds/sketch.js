/* Mount a sketch fragment. Scripts do not run. */
import DrawerStyleLine from '../core/style-line.js';
import { emit, call } from '../core/hooks.js';
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
  // Scripts are not filtered here. The sandboxed frame lets the browser refuse every script, handler, and javascript: URL.
  var banned = tpl.content.querySelectorAll("iframe, object, embed, link");
  for (var i = banned.length - 1; i >= 0; i -= 1) banned[i].remove();
  return tpl.content;
}

function bindWorld(rootEl, boundsFn) {
  call("setWorld", rootEl || null, boundsFn || null);
}

export function renderSketch(opts) {
  opts = opts || {};
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
  var frame = document.createElement("iframe");
  frame.className = "sketch-frame";
  // The sandbox grants no script permission: the browser refuses every script, handler, and javascript: URL.
  // same-origin only lets Board read the size; nothing in the frame can run.
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("scrolling", "no");
  // Width follows #preview exactly like the fragment did as a block, so layout and saved cameras match.
  frame.style.cssText = "display:block;border:0;width:100%;height:800px;background:transparent;pointer-events:none;";
  frame.srcdoc = "<!doctype html><html><head><meta charset=\"utf-8\"><style>html,body{margin:0;padding:0;background:transparent}</style></head><body>" + holder.innerHTML + "</body></html>";
  function fitHeight() {
    var doc = frame.contentDocument;
    if (!frame.isConnected || !doc || !doc.body) return;
    // A root wider than the canvas widens the frame, so nothing is clipped.
    var w = Math.ceil(doc.documentElement.scrollWidth);
    if (w > frame.clientWidth) frame.style.minWidth = w + "px";
    var h = Math.ceil(Math.max(doc.body.getBoundingClientRect().height, doc.body.scrollHeight));
    if (h > 0 && h !== frame.offsetHeight) frame.style.height = h + "px";
  }
  var finished = false;
  function onReady() {
    if (finished || !frame.isConnected) return;
    finished = true;
    fitHeight();
    if (typeof ResizeObserver === "function") new ResizeObserver(fitHeight).observe(frame);
    bindWorld(frame, function () { return sketchWorldBounds(frame); });
    showDiagramError("");
    setStatus("Sketch rendered · " + new Date().toLocaleTimeString());
    emit("finishCanvasView", opts);
  }
  // Only the srcdoc load finishes the sketch. A new iframe first holds an empty about:blank document that already
  // reports "complete" at 800px; measuring it would pin the frame there and skip the real load.
  frame.addEventListener("load", onReady);
  previewEl.appendChild(frame);
}

const Sketch = {
  renderSketch: renderSketch,
  sketchWorldBounds: sketchWorldBounds,
  sketchFragmentRoot: sketchFragmentRoot,
};

export default Sketch;
