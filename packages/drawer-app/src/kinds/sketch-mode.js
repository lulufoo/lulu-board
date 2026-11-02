/* The Canvas | Present switch of a Sketch.
   The mode lives on <html data-sketch-mode>, not in a variable. 09-sketch-mode.css turns it into the frame's pointer
   input: Canvas leaves the frame inert so the canvas pans and zooms over it, Present lets clicks reach the sketch.
   Both functions take the document, so Node tests can drive them with a fake one. */

var MODE_BUTTONS = { canvas: "btnSketchCanvas", present: "btnSketchPresent" };

export function setSketchMode(mode, doc) {
  var next = mode === "present" ? "present" : "canvas";
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
    if (button) setSketchMode(button.dataset.mode, doc);
  });
  setSketchMode("canvas", doc);
}
