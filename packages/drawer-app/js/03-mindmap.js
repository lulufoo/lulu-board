/* Mindmap toolbar + Properties. Own field IDs; do not reuse Board / flowchart props. */
var MINDMAP_SEED = "%% title Untitled\nmindmap\n  Topic\n";
var MINDMAP_LAYOUT_KEY = "mindmapLayout";
var selectedMindmap = null;
var mindmapPropsFill = false;

var mindmapAddRootButton = document.getElementById("btnMindmapAddRoot");
var mindmapAddNodeButton = document.getElementById("btnMindmapAddNode");
var mindmapDeleteButton = document.getElementById("btnMindmapDelete");
var mindmapPropsFields = document.getElementById("mindmapPropsFields");
var mindmapTextEditor = document.getElementById("mindmapTextEditor");
var mindmapDocTitleField = document.getElementById("mindmapDocTitleField");
var mindmapDocTitleEditor = document.getElementById("mindmapDocTitleEditor");
var mindmapLayoutField = document.getElementById("mindmapLayoutField");
var mindmapLayoutEditor = document.getElementById("mindmapLayoutEditor");
var mindmapPropsHint = document.getElementById("mindmapPropsHint");

function isMindmapKind() {
  return document.documentElement.dataset.diagramKind === "mindmap";
}

function mindmapSource() {
  return velaSourceEl ? velaSourceEl.value : "";
}

function currentMindmapLayout() {
  try {
    return localStorage.getItem(MINDMAP_LAYOUT_KEY) === "logic" ? "logic" : "radial";
  } catch (_e) {
    return "radial";
  }
}

function setMindmapLayout(name) {
  var next = name === "logic" ? "logic" : "radial";
  try { localStorage.setItem(MINDMAP_LAYOUT_KEY, next); } catch (_e) {}
}

function mindmapHasRoot() {
  if (typeof MindmapEdit === "undefined" || !MindmapEdit.parseMindmap) return false;
  var parsed = MindmapEdit.parseMindmap(typeof sourceBodyForKind === "function" ? sourceBodyForKind(mindmapSource()) : mindmapSource());
  return !!(parsed && parsed.root);
}

function mindmapEditAction(action) {
  try {
    if (typeof MindmapEdit === "undefined") throw new Error("MindmapEdit missing — hard refresh (cache)");
    var result = action();
    if (result && result.source != null && velaSourceEl) {
      velaSourceEl.value = result.source;
      if (typeof updateVelaChars === "function") updateVelaChars();
      if (typeof scheduleBoardSave === "function") scheduleBoardSave();
    }
    if (result && result.selection) selectedMindmap = result.selection;
    if (typeof renderVela === "function") renderVela({ fit: false });
    return result;
  } catch (err) {
    if (typeof setStatus === "function") setStatus(err instanceof Error ? err.message : String(err), true);
    return null;
  }
}

function hideMindmapFields() {
  if (mindmapDocTitleField) mindmapDocTitleField.hidden = true;
  if (mindmapLayoutField) mindmapLayoutField.hidden = true;
  if (mindmapPropsFields) mindmapPropsFields.hidden = true;
}

function syncMindmapButtons() {
  var hasRoot = mindmapHasRoot();
  if (mindmapAddRootButton) mindmapAddRootButton.disabled = hasRoot;
  if (mindmapAddNodeButton) mindmapAddNodeButton.disabled = !hasRoot;
  var canDelete = !!(selectedMindmap && !selectedMindmap.isRoot);
  if (mindmapDeleteButton) mindmapDeleteButton.disabled = !canDelete;
}

function fillMindmapProps() {
  if (!isMindmapKind()) {
    hideMindmapFields();
    return;
  }
  mindmapPropsFill = true;
  if (propsEmpty) propsEmpty.hidden = true;
  if (mindmapDocTitleField) mindmapDocTitleField.hidden = false;
  if (mindmapLayoutField) mindmapLayoutField.hidden = false;
  if (mindmapDocTitleEditor && typeof MindmapEdit !== "undefined" && MindmapEdit.getTitle) {
    mindmapDocTitleEditor.value = MindmapEdit.getTitle(mindmapSource()) || "";
  }
  if (mindmapLayoutEditor) mindmapLayoutEditor.value = currentMindmapLayout();
  if (selectedMindmap) {
    if (mindmapPropsFields) mindmapPropsFields.hidden = false;
    if (mindmapTextEditor) mindmapTextEditor.value = selectedMindmap.label || "";
    if (mindmapPropsHint) mindmapPropsHint.textContent = selectedMindmap.isRoot ? "Root selected · cannot delete" : "Topic selected";
  } else {
    if (mindmapPropsFields) mindmapPropsFields.hidden = true;
    if (mindmapPropsHint) mindmapPropsHint.textContent = "";
  }
  syncMindmapButtons();
  mindmapPropsFill = false;
}

function clearMindmapSelection() {
  selectedMindmap = null;
  syncMindmapButtons();
  if (isMindmapKind()) fillMindmapProps();
}

function selectMindmapTopic(sel) {
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
}

function restoreMindmapSelection() {
  if (!isMindmapKind() || !selectedMindmap || typeof MindmapEdit === "undefined") return;
  var info = MindmapEdit.getTopic(mindmapSource(), selectedMindmap.path);
  if (!info) {
    selectedMindmap = null;
    syncMindmapButtons();
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
}

function commitMindmapDocTitle() {
  if (mindmapPropsFill || !isMindmapKind() || typeof MindmapEdit === "undefined") return;
  var next = mindmapDocTitleEditor ? String(mindmapDocTitleEditor.value || "").trim() : "";
  if (next === MindmapEdit.getTitle(mindmapSource())) return;
  mindmapEditAction(function () { return MindmapEdit.updateTitle(mindmapSource(), next); });
}

function commitMindmapText() {
  if (mindmapPropsFill || !selectedMindmap || typeof MindmapEdit === "undefined") return;
  var next = mindmapTextEditor ? String(mindmapTextEditor.value || "").trim() : "";
  mindmapEditAction(function () { return MindmapEdit.updateTopicLabel(mindmapSource(), selectedMindmap.path, next); });
}

function commitMindmapLayout() {
  if (mindmapPropsFill || !isMindmapKind()) return;
  var next = mindmapLayoutEditor ? mindmapLayoutEditor.value : "radial";
  if (next === currentMindmapLayout()) return;
  setMindmapLayout(next);
  if (typeof renderVela === "function") renderVela({ fit: false });
}

function addMindmapRoot() {
  if (mindmapHasRoot()) return;
  if (!velaSourceEl) return;
  velaSourceEl.value = MINDMAP_SEED;
  selectedMindmap = null;
  if (typeof updateVelaChars === "function") updateVelaChars();
  if (typeof scheduleBoardSave === "function") scheduleBoardSave();
  if (typeof renderVela === "function") renderVela({ fit: true });
}

function addMindmapChild(parentRef) {
  var parent = parentRef;
  if (parent == null) parent = selectedMindmap ? selectedMindmap.path : [];
  mindmapEditAction(function () { return MindmapEdit.addChild(mindmapSource(), parent, "Node"); });
}

function deleteMindmapTopic() {
  if (!selectedMindmap || selectedMindmap.isRoot) return;
  mindmapEditAction(function () { return MindmapEdit.deleteTopic(mindmapSource(), selectedMindmap.path); });
}

function mindmapHitFromEvent(event) {
  if (!event || !event.target || !event.target.closest) return null;
  var add = event.target.closest(".mindmap-add");
  if (add) return { kind: "add", parent: add.getAttribute("data-add-parent") };
  if (typeof MindmapEdit === "undefined" || !MindmapEdit.selectionFromDom) return null;
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

if (previewEl) {
  previewEl.addEventListener("click", function (event) {
    if (!isMindmapKind()) return;
    var hit = mindmapHitFromEvent(event);
    if (hit && hit.kind === "add") {
      event.preventDefault();
      addMindmapChild(hit.parent);
      return;
    }
    if (hit && hit.kind === "topic") selectMindmapTopic(hit);
  });
}

document.addEventListener("keydown", function (event) {
  if (!isMindmapKind()) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedMindmap || selectedMindmap.isRoot) return;
  var target = event.target;
  if (target === velaSourceEl || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  event.preventDefault();
  deleteMindmapTopic();
});

if (typeof module === "object" && module.exports) {
  module.exports = {
    MINDMAP_SEED: MINDMAP_SEED,
    MINDMAP_LAYOUT_KEY: MINDMAP_LAYOUT_KEY,
    currentMindmapLayout: currentMindmapLayout,
    setMindmapLayout: setMindmapLayout,
  };
}
