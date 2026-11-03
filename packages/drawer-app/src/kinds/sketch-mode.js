/* The Canvas | Present switch of a Sketch.
   The live mode sits on <html data-sketch-mode>. 09-sketch-mode.css turns it into the frame's pointer input:
   Canvas leaves the frame inert so the canvas pans and zooms over it. Present lets clicks reach the
   sketch and locks blank pan, wheel zoom, and blank dblclick on the host ground. A click on that
   ground still closes the open dock.
   The choice is the host cookie drawer.sketchMode, the same kind of store as theme, so a new sketch keeps it.
   Both DOM functions take the document, so Node tests can drive them with a fake one. */

var MODE_BUTTONS = { canvas: "btnSketchCanvas", present: "btnSketchPresent" };
export var SKETCH_MODE_COOKIE = "drawer.sketchMode";
var SKETCH_MODE_MAX_AGE = 60 * 60 * 24 * 365;

function resolveSketchMode(mode) {
  return mode === "present" ? "present" : "canvas";
}

function sketchModeCookieSource() {
  try {
    if (typeof document === "undefined") return "";
    var raw = document.cookie;
    return typeof raw === "string" ? raw : "";
  } catch (_e) {
    return "";
  }
}

export function readSketchModeCookie(raw) {
  var source = raw == null ? sketchModeCookieSource() : String(raw);
  var found = "canvas";
  var parts = source.split(";");
  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i].trim();
    var eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== SKETCH_MODE_COOKIE) continue;
    try {
      found = resolveSketchMode(decodeURIComponent(part.slice(eq + 1).trim()));
    } catch (_e) {
      found = "canvas";
    }
  }
  return found;
}

export function writeSketchModeCookie(mode) {
  var value = resolveSketchMode(mode);
  var line = SKETCH_MODE_COOKIE + "=" + encodeURIComponent(value)
    + "; Path=/; SameSite=Lax; Max-Age=" + SKETCH_MODE_MAX_AGE;
  try {
    if (typeof location !== "undefined" && location.protocol === "https:") line += "; Secure";
  } catch (_e) {}
  try {
    if (typeof document !== "undefined") document.cookie = line;
  } catch (_e) {}
  return line;
}

var sketchModeCurrent = readSketchModeCookie();

export function getSessionSketchMode() {
  return sketchModeCurrent;
}

export function setSessionSketchMode(mode) {
  sketchModeCurrent = resolveSketchMode(mode);
  writeSketchModeCookie(sketchModeCurrent);
  return sketchModeCurrent;
}

export function setSketchMode(mode, doc) {
  var next = resolveSketchMode(mode);
  var root = doc.documentElement;
  if (root) root.dataset.sketchMode = next;
  Object.keys(MODE_BUTTONS).forEach(function (name) {
    var button = doc.getElementById(MODE_BUTTONS[name]);
    if (button) button.setAttribute("aria-pressed", name === next ? "true" : "false");
  });
}

export function bindSketchMode(doc) {
  var group = doc.getElementById("sketchModeTools");
  if (!group) return;
  group.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest(".sketch-mode-btn") : null;
    if (!button) return;
    setSessionSketchMode(button.dataset.mode);
    setSketchMode(getSessionSketchMode(), doc);
  });
  setSketchMode(getSessionSketchMode(), doc);
}
