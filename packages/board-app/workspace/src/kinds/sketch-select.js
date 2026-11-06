/* Sketch selection in Canvas mode: click a piece of text to select it, click it again to edit it in Properties.
 *
 * The picture is another origin, so Board asks the runner what is under the pointer and gets an id back. Board
 * does not trust that id for content: it looks the id up in its own parse of the source, shows the text it finds
 * there, and a lookup that finds nothing is a click on blank. An edit goes into the source first, then the runner
 * is told to show the same text. The frame is never mounted again for a text edit. */
import DrawerStyleLine from '../core/style-line.js';
import { register, emit } from '../core/hooks.js';
import {
  listSketchLeaves,
  readSketchLeaf,
  writeSketchLeaf,
  sameSketchLeaves,
  swapSketchContent,
} from '../core/sketch-source.js';
import { CanvasInteraction } from '../state/canvas-interaction.js';
import {
  diagramSourceEl,
  propsEmpty,
  propsFields,
  propsKindLabel,
  openPropsPanel,
  updateDiagramChars,
} from '../state/shell-state.js';
import { getSketchFrame, sketchTemplate, syncMountedSketch } from './sketch.js';
import { pickSketch, markSketch, patchSketchText } from './sketch-bridge.js';

// The piece of text that is selected: its id, its tag, and the white space the text box does not show.
var selectedSketch = null;
// Each click gets a number. An answer that comes back for an older click than the newest is dropped.
var pickToken = 0;
var propsFilling = false;

function findById(id) {
  return typeof document !== "undefined" && document.getElementById ? document.getElementById(id) : null;
}

var sketchPropsFields = findById("sketch-props-fields");
var sketchTextEditor = findById("sketch-text-editor");

function isSketchKind() {
  return typeof document !== "undefined" && document.documentElement
    ? document.documentElement.dataset.kind === "sketch"
    : false;
}

/* The source parsed again, as Board reads it. Nothing is stamped, so it can be written back as it is. */
function parseSketchSource() {
  return sketchTemplate(DrawerStyleLine.decodeSketchContent(diagramSourceEl ? diagramSourceEl.value : ""));
}

function fillSketchProps(leaf) {
  if (!isSketchKind()) return;
  propsFilling = true;
  var on = !!leaf;
  if (propsEmpty) {
    propsEmpty.hidden = on;
    propsEmpty.textContent = "Select a text";
  }
  if (propsFields) propsFields.hidden = true;
  if (sketchPropsFields) sketchPropsFields.hidden = !on;
  if (propsKindLabel) propsKindLabel.textContent = on ? leaf.tag : "—";
  if (sketchTextEditor) sketchTextEditor.value = on ? leaf.text : "";
  propsFilling = false;
}

function selectSketchText(id, leaf) {
  selectedSketch = { id: id, tag: leaf.tag, lead: leaf.lead, trail: leaf.trail };
  markSketch(getSketchFrame(), id);
  fillSketchProps(leaf);
}

export function clearSketchSelection() {
  // An answer still on its way belongs to a click that no longer holds.
  pickToken += 1;
  var had = selectedSketch;
  selectedSketch = null;
  if (had) markSketch(getSketchFrame(), null);
  fillSketchProps(null);
}

function inspectSketchSelection() {
  openPropsPanel();
  if (!sketchTextEditor) return;
  sketchTextEditor.focus();
  sketchTextEditor.select();
}

/* A click on the picture that moved nothing. True means this decides it, later. Present mode is not ours: there
 * the picture takes its own clicks. */
function probeSketchClick(clientX, clientY) {
  var frame = getSketchFrame();
  if (!frame || CanvasInteraction.isSketchPresent()) return false;
  pickToken += 1;
  var token = pickToken;
  pickSketch(frame, clientX, clientY).then(function (id) {
    if (token !== pickToken || frame !== getSketchFrame()) return;
    var leaf = id ? readSketchLeaf(parseSketchSource().content, id) : null;
    if (!leaf) {
      CanvasInteraction.leaveBlank();
      return;
    }
    if (selectedSketch && selectedSketch.id === id) inspectSketchSelection();
    else selectSketchText(id, leaf);
  });
  return true;
}

/* The text box changed. Write the new text into the source, then show it in the picture. If writing moved any
 * other id, the frame's ids are wrong, so the source is still saved but the frame mounts again. */
function commitSketchText() {
  if (propsFilling || !selectedSketch || !sketchTextEditor || !diagramSourceEl) return;
  var chosen = selectedSketch;
  var text = chosen.lead + sketchTextEditor.value + chosen.trail;
  var source = diagramSourceEl.value;
  var tpl = parseSketchSource();
  var before = listSketchLeaves(tpl.content);
  if (!writeSketchLeaf(tpl.content, chosen.id, text)) return;
  var html = tpl.innerHTML;
  var next = swapSketchContent(source, html);
  if (next === null) return;
  var steady = sameSketchLeaves(before, listSketchLeaves(sketchTemplate(html).content), chosen.id);
  diagramSourceEl.value = next;
  updateDiagramChars();
  emit("scheduleDiagramSave");
  if (!steady) {
    emit("renderDiagram", { fit: false });
    return;
  }
  syncMountedSketch();
  patchSketchText(getSketchFrame(), chosen.id, text);
}

if (sketchTextEditor) sketchTextEditor.addEventListener("input", commitSketchText);

// Present hands the picture its own clicks, so a ring left on a piece of text would only be stale.
var sketchModeTools = findById("sketchModeTools");
if (sketchModeTools) {
  sketchModeTools.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest(".sketch-mode-btn") : null;
    if (button && button.dataset.mode === "present") clearSketchSelection();
  });
}

if (CanvasInteraction && typeof CanvasInteraction.registerKind === "function") {
  CanvasInteraction.registerKind("sketch", { probe: probeSketchClick, clear: clearSketchSelection });
}
register("clearSketchSelection", clearSketchSelection);

const SketchSelect = {
  clearSketchSelection: clearSketchSelection,
};

export default SketchSelect;
