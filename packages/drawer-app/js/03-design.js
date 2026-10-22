/* Design Properties: one shared Title field. Source edits the body. */
var designDocTitleField = document.getElementById("designDocTitleField");
var designDocTitleEditor = document.getElementById("designDocTitleEditor");
var designPropsFill = false;

function isDesignKindActive() {
  var kind = document.documentElement && document.documentElement.dataset
    ? document.documentElement.dataset.kind
    : "";
  return typeof DrawerStyleLine !== "undefined" && DrawerStyleLine.isDesignKind
    ? DrawerStyleLine.isDesignKind(kind)
    : false;
}

function hideDesignFields() {
  if (designDocTitleField) designDocTitleField.hidden = true;
}

function fillDesignProps() {
  if (!isDesignKindActive()) {
    hideDesignFields();
    return;
  }
  designPropsFill = true;
  if (propsEmpty) propsEmpty.hidden = true;
  if (designDocTitleField) designDocTitleField.hidden = false;
  var src = diagramSourceEl ? diagramSourceEl.value : "";
  if (designDocTitleEditor && typeof diagramTitleFromBody === "function") {
    designDocTitleEditor.value = diagramTitleFromBody(src) || "";
  }
  if (propsKindLabel) propsKindLabel.textContent = document.documentElement.dataset.kind || "—";
  designPropsFill = false;
}

function commitDesignDocTitle() {
  if (designPropsFill || !isDesignKindActive()) return;
  if (typeof updateMermaidTitle !== "function" || !diagramSourceEl) return;
  var next = designDocTitleEditor ? String(designDocTitleEditor.value || "").replace(/[\r\n]/g, " ").trim() : "";
  var current = typeof diagramTitleFromBody === "function" ? diagramTitleFromBody(diagramSourceEl.value) : "";
  if (next === current) return;
  diagramSourceEl.value = updateMermaidTitle(diagramSourceEl.value, next);
  if (typeof updateDiagramChars === "function") updateDiagramChars();
  if (typeof scheduleDiagramSave === "function") scheduleDiagramSave();
  if (typeof renderDiagram === "function") renderDiagram({ fit: false });
}

if (designDocTitleEditor) {
  designDocTitleEditor.addEventListener("change", commitDesignDocTitle);
  designDocTitleEditor.addEventListener("blur", commitDesignDocTitle);
}
