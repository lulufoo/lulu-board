/* drawer-app/03-sketch.js — mount a sketch fragment. Scripts do not run. */

function sketchWorldBounds(el) {
  if (!el) return null;
  var w = el.offsetWidth;
  var h = el.offsetHeight;
  if (!(w > 0 && h > 0)) return null;
  return { minX: 0, minY: 0, maxX: w, maxY: h, width: w, height: h, cx: w / 2, cy: h / 2 };
}

function sketchShadowCss(css) {
  return String(css || "").replace(/:root\b/gi, ":host");
}

function sketchFragmentRoot(html) {
  var tpl = document.createElement("template");
  tpl.innerHTML = String(html || "");
  var banned = tpl.content.querySelectorAll("script, iframe, object, embed, link");
  for (var i = banned.length - 1; i >= 0; i -= 1) banned[i].remove();
  var nodes = tpl.content.querySelectorAll("*");
  for (var n = 0; n < nodes.length; n += 1) {
    var attrs = nodes[n].attributes;
    for (var a = attrs.length - 1; a >= 0; a -= 1) {
      if (/^on/i.test(attrs[a].name)) nodes[n].removeAttribute(attrs[a].name);
    }
  }
  var styles = tpl.content.querySelectorAll("style");
  for (var s = 0; s < styles.length; s += 1) {
    styles[s].textContent = sketchShadowCss(styles[s].textContent);
  }
  return tpl.content;
}

function renderSketch(opts) {
  opts = opts || {};
  previewEl.classList.remove("board-preview");
  var fragment = "";
  if (typeof DrawerStyleLine !== "undefined" && typeof DrawerStyleLine.decodeSketchContent === "function") {
    fragment = DrawerStyleLine.decodeSketchContent(diagramSourceEl ? diagramSourceEl.value : "");
  }
  previewEl.innerHTML = "";
  if (!String(fragment || "").trim()) {
    bindCanvasWorld(null, null);
    showDiagramError("Sketch content missing");
    setStatus("Sketch content missing", true);
    finishCanvasView(opts);
    return;
  }
  var frame = document.createElement("div");
  frame.className = "sketch-frame";
  var host = document.createElement("div");
  host.className = "sketch-host";
  var shadowRoot = host.attachShadow({ mode: "open" });
  shadowRoot.appendChild(sketchFragmentRoot(fragment));
  frame.appendChild(host);
  previewEl.appendChild(frame);
  var board = shadowRoot.querySelector(".sketch-board") || host;
  bindCanvasWorld(board, function () { return sketchWorldBounds(board); });
  showDiagramError("");
  setStatus("Sketch rendered · " + new Date().toLocaleTimeString());
  finishCanvasView(opts);
}

if (typeof module === "object" && module.exports) module.exports = { sketchShadowCss: sketchShadowCss };
