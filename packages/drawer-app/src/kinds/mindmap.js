/* Mindmap toolbar + Properties. Own field IDs; do not reuse Board / flowchart props. */
import MindmapEdit from '../../../mermaid-ext/mindmap/index.js';
import { emit } from '../core/hooks.js';
import { stripDocumentMeta } from '../core/document-meta.js';
import DrawerStyleLine from '../core/style-line.js';
import { applyMindmapSelectionVisual } from './mindmap-select.js';
import {
  diagramSourceEl,
  propsEmpty,
  propsKindLabel,
  setStatus,
  updateDiagramChars,
} from '../state/shell-state.js';

export const MINDMAP_SEED = "%% title Untitled\nmindmap\n  Topic\n";
export const MINDMAP_LAYOUT_KEY = "mindmapLayout";
export let selectedMindmap = null;
var mindmapPropsFill = false;

function el(id) {
  return typeof document !== "undefined" && document.getElementById
    ? document.getElementById(id)
    : null;
}

var mindmapAddRootButton = el("btnMindmapAddRoot");
var mindmapAddNodeButton = el("btnMindmapAddNode");
var mindmapDeleteButton = el("btnMindmapDelete");
var mindmapPropsFields = el("mindmapPropsFields");
var mindmapTextEditor = el("mindmapTextEditor");
var mindmapDocTitleField = el("mindmapDocTitleField");
var mindmapDocTitleEditor = el("mindmapDocTitleEditor");
var mindmapLayoutField = el("mindmapLayoutField");
var mindmapLayoutEditor = el("mindmapLayoutEditor");
var mindmapPropsHint = el("mindmapPropsHint");

function mindmapApi() {
  return MindmapEdit;
}

function sourceBodyForKind(text) {
  var raw = String(text == null ? "" : text);
  try { raw = stripDocumentMeta(raw); } catch (_e) {}
  if (DrawerStyleLine.splitRendererStyle) {
    raw = DrawerStyleLine.splitRendererStyle(raw).body;
  }
  return raw;
}

export function setSelectedMindmap(next) {
  selectedMindmap = next;
}

export function isMindmapKind() {
  return typeof document !== "undefined" && document.documentElement
    ? document.documentElement.dataset.kind === "mindmap"
    : false;
}

function mindmapSource() {
  return diagramSourceEl ? diagramSourceEl.value : "";
}

export function currentMindmapLayout() {
  try {
    return localStorage.getItem(MINDMAP_LAYOUT_KEY) === "logic" ? "logic" : "radial";
  } catch (_e) {
    return "radial";
  }
}

export function setMindmapLayout(name) {
  var next = name === "logic" ? "logic" : "radial";
  try { localStorage.setItem(MINDMAP_LAYOUT_KEY, next); } catch (_e) {}
}

export function mindmapHasRoot() {
  var MindmapEdit = mindmapApi();
  if (!MindmapEdit || !MindmapEdit.parseMindmap) return false;
  var parsed = MindmapEdit.parseMindmap(sourceBodyForKind(mindmapSource()));
  return !!(parsed && parsed.root);
}

function mindmapEditAction(action) {
  try {
    var MindmapEdit = mindmapApi();
    if (!MindmapEdit) throw new Error("MindmapEdit missing — hard refresh (cache)");
    var result = action();
    if (result && result.source != null && diagramSourceEl) {
      diagramSourceEl.value = result.source;
      updateDiagramChars();
      emit("scheduleDiagramSave");
    }
    if (result && result.selection) selectedMindmap = result.selection;
    emit("renderDiagram", { fit: false });
    return result;
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
    return null;
  }
}

export function hideMindmapFields() {
  if (mindmapDocTitleField) mindmapDocTitleField.hidden = true;
  if (mindmapLayoutField) mindmapLayoutField.hidden = true;
  if (mindmapPropsFields) mindmapPropsFields.hidden = true;
}

export function syncMindmapButtons() {
  var hasRoot = mindmapHasRoot();
  if (mindmapAddRootButton) mindmapAddRootButton.disabled = hasRoot;
  if (mindmapAddNodeButton) mindmapAddNodeButton.disabled = !hasRoot;
  var canDelete = !!(selectedMindmap && !selectedMindmap.isRoot);
  if (mindmapDeleteButton) mindmapDeleteButton.disabled = !canDelete;
}

export function fillMindmapProps() {
  if (!isMindmapKind()) {
    hideMindmapFields();
    return;
  }
  mindmapPropsFill = true;
  if (propsEmpty) propsEmpty.hidden = true;
  var topicOn = !!selectedMindmap;
  if (mindmapDocTitleField) mindmapDocTitleField.hidden = topicOn;
  if (mindmapLayoutField) mindmapLayoutField.hidden = topicOn;
  if (propsKindLabel) propsKindLabel.textContent = topicOn ? (selectedMindmap.isRoot ? "root" : "node") : "—";
  var MindmapEdit = mindmapApi();
  if (!topicOn) {
    if (mindmapDocTitleEditor && MindmapEdit && MindmapEdit.getTitle) {
      mindmapDocTitleEditor.value = MindmapEdit.getTitle(mindmapSource()) || "";
    }
    if (mindmapLayoutEditor) mindmapLayoutEditor.value = currentMindmapLayout();
    if (mindmapPropsFields) mindmapPropsFields.hidden = true;
    if (mindmapPropsHint) mindmapPropsHint.textContent = "";
  } else {
    if (mindmapPropsFields) mindmapPropsFields.hidden = false;
    if (mindmapTextEditor) mindmapTextEditor.value = selectedMindmap.label || "";
    if (mindmapPropsHint) mindmapPropsHint.textContent = selectedMindmap.isRoot ? "Root selected · cannot delete" : "Topic selected";
  }
  syncMindmapButtons();
  mindmapPropsFill = false;
}

export function clearMindmapSelection() {
  selectedMindmap = null;
  restoreMindmapVisual();
  syncMindmapButtons();
  if (isMindmapKind()) fillMindmapProps();
}

export function selectMindmapTopic(sel) {
  if (!sel) {
    clearMindmapSelection();
    return;
  }
  selectedMindmap = {
    kind: "topic",
    id: sel.id,
    path: sel.path || [],
    key: sel.key || ("topic:" + (sel.path || []).join(".")),
    label: sel.label || "",
    isRoot: !!(sel.isRoot || (sel.path && !sel.path.length)),
  };
  fillMindmapProps();
  restoreMindmapVisual();
}

export function restoreMindmapSelection() {
  var MindmapEdit = mindmapApi();
  if (!isMindmapKind() || !selectedMindmap || !MindmapEdit) return;
  var info = MindmapEdit.getTopic(mindmapSource(), selectedMindmap.path);
  if (!info) {
    selectedMindmap = null;
    fillMindmapProps();
    return;
  }
  selectedMindmap = {
    kind: "topic",
    id: info.id,
    path: info.path,
    key: info.key,
    label: info.label,
    isRoot: info.isRoot,
  };
  fillMindmapProps();
  restoreMindmapVisual();
}

function commitMindmapDocTitle() {
  var MindmapEdit = mindmapApi();
  if (mindmapPropsFill || !isMindmapKind() || !MindmapEdit) return;
  var next = mindmapDocTitleEditor ? String(mindmapDocTitleEditor.value || "").trim() : "";
  if (next === MindmapEdit.getTitle(mindmapSource())) return;
  mindmapEditAction(function () { return MindmapEdit.updateTitle(mindmapSource(), next); });
}

function commitMindmapText() {
  var MindmapEdit = mindmapApi();
  if (mindmapPropsFill || !selectedMindmap || !MindmapEdit) return;
  var next = mindmapTextEditor ? String(mindmapTextEditor.value || "").trim() : "";
  mindmapEditAction(function () { return MindmapEdit.updateTopicLabel(mindmapSource(), selectedMindmap.path, next); });
}

function commitMindmapLayout() {
  if (mindmapPropsFill || !isMindmapKind()) return;
  var next = mindmapLayoutEditor ? mindmapLayoutEditor.value : "radial";
  if (next === currentMindmapLayout()) return;
  setMindmapLayout(next);
  emit("renderDiagram", { fit: false });
}

export function addMindmapRoot() {
  if (mindmapHasRoot()) return;
  if (!diagramSourceEl) return;
  diagramSourceEl.value = MINDMAP_SEED;
  selectedMindmap = null;
  updateDiagramChars();
  emit("scheduleDiagramSave");
  emit("renderDiagram", { fit: true });
}

export function addMindmapChild(parentRef) {
  var MindmapEdit = mindmapApi();
  var parent = parentRef;
  if (parent == null) parent = selectedMindmap ? selectedMindmap.path : [];
  mindmapEditAction(function () { return MindmapEdit.addChild(mindmapSource(), parent, "Node"); });
}

export function deleteMindmapTopic() {
  var MindmapEdit = mindmapApi();
  if (!selectedMindmap || selectedMindmap.isRoot || !MindmapEdit) return;
  mindmapEditAction(function () { return MindmapEdit.deleteTopic(mindmapSource(), selectedMindmap.path); });
}

export function mindmapHitFromEvent(event) {
  if (!event || !event.target || !event.target.closest) return null;
  var add = event.target.closest(".mindmap-add");
  if (add) return { kind: "add", parent: add.getAttribute("data-add-parent") };
  var MindmapEdit = mindmapApi();
  if (!MindmapEdit || !MindmapEdit.selectionFromDom) return null;
  return MindmapEdit.selectionFromDom(event.target);
}

if (mindmapAddRootButton) mindmapAddRootButton.onclick = addMindmapRoot;
if (mindmapAddNodeButton) mindmapAddNodeButton.onclick = function () { addMindmapChild(); };
if (mindmapDeleteButton) mindmapDeleteButton.onclick = deleteMindmapTopic;
if (mindmapDocTitleEditor) {
  mindmapDocTitleEditor.addEventListener("change", commitMindmapDocTitle);
  mindmapDocTitleEditor.addEventListener("blur", commitMindmapDocTitle);
}
if (mindmapTextEditor) {
  mindmapTextEditor.addEventListener("change", commitMindmapText);
  mindmapTextEditor.addEventListener("blur", commitMindmapText);
}
if (mindmapLayoutEditor) mindmapLayoutEditor.addEventListener("change", commitMindmapLayout);

function restoreMindmapVisual() {
  applyMindmapSelectionVisual();
}

if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("keydown", function (event) {
    if (!isMindmapKind()) return;
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (!selectedMindmap || selectedMindmap.isRoot) return;
    var target = event.target;
    if (target === diagramSourceEl || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    event.preventDefault();
    deleteMindmapTopic();
  });
}

const Mindmap = {
  MINDMAP_SEED: MINDMAP_SEED,
  MINDMAP_LAYOUT_KEY: MINDMAP_LAYOUT_KEY,
  currentMindmapLayout: currentMindmapLayout,
  setMindmapLayout: setMindmapLayout,
  isMindmapKind: isMindmapKind,
  fillMindmapProps: fillMindmapProps,
  hideMindmapFields: hideMindmapFields,
  syncMindmapButtons: syncMindmapButtons,
  clearMindmapSelection: clearMindmapSelection,
  selectMindmapTopic: selectMindmapTopic,
  restoreMindmapSelection: restoreMindmapSelection,
  addMindmapRoot: addMindmapRoot,
  addMindmapChild: addMindmapChild,
  deleteMindmapTopic: deleteMindmapTopic,
  mindmapHitFromEvent: mindmapHitFromEvent,
  mindmapHasRoot: mindmapHasRoot,
  setSelectedMindmap: setSelectedMindmap,
};

export default Mindmap;
