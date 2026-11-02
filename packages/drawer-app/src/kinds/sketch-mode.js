/* The Canvas | Present switch of a Sketch.
   The mode lives on <html data-sketch-mode>, not in a variable. 09-sketch-mode.css turns it into the frame's pointer
   input: Canvas leaves the frame inert so the canvas pans and zooms over it, Present lets clicks reach the sketch.
   The fragment is told the mode too: sketch.js sends it with the render and after every switch.
   Every function takes the document, so Node tests can drive them with a fake one. */

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

export function getSketchMode(doc) {
  var root = doc.documentElement;
  return root && root.dataset.sketchMode === "present" ? "present" : "canvas";
}

/* onChange(mode) runs after a click that changed the mode. It does not run for the reset to Canvas. */
export function bindSketchMode(doc, onChange) {
  var group = doc.getElementById("sketchModeTools");
  if (!group) return;
  group.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest(".sketch-mode-btn") : null;
    if (!button) return;
    var before = getSketchMode(doc);
    setSketchMode(button.dataset.mode, doc);
    var after = getSketchMode(doc);
    if (onChange && after !== before) onChange(after);
  });
  setSketchMode("canvas", doc);
}
