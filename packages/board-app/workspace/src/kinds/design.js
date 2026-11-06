/* Design Properties: one shared Title field. Source edits the body. */
import DrawerStyleLine from '../core/style-line.js';
import { emit } from '../core/hooks.js';
import { CanvasInteraction } from '../state/canvas-interaction.js';
import { diagramTitleFromBody, updateMermaidTitle } from '../core/document-meta.js';
import {
  diagramSourceEl,
  propsEmpty,
  propsKindLabel,
  updateDiagramChars,
} from '../state/shell-state.js';

function el(id) {
  return typeof document !== "undefined" && document.getElementById
    ? document.getElementById(id)
    : null;
}

var designDocTitleField = el("designDocTitleField");
var designDocTitleEditor = el("designDocTitleEditor");
var designPropsFill = false;

export function isDesignKindActive() {
  var kind = typeof document !== "undefined" && document.documentElement && document.documentElement.dataset
    ? document.documentElement.dataset.kind
    : "";
  return DrawerStyleLine.isDesignKind ? DrawerStyleLine.isDesignKind(kind) : false;
}

export function hideDesignFields() {
  if (designDocTitleField) designDocTitleField.hidden = true;
}

export function fillDesignProps() {
  if (!isDesignKindActive()) {
    hideDesignFields();
    return;
  }
  designPropsFill = true;
  if (propsEmpty) propsEmpty.hidden = true;
  if (designDocTitleField) designDocTitleField.hidden = false;
  var src = diagramSourceEl ? diagramSourceEl.value : "";
  if (designDocTitleEditor) {
    designDocTitleEditor.value = diagramTitleFromBody(src) || "";
  }
  if (propsKindLabel && typeof document !== "undefined" && document.documentElement) {
    propsKindLabel.textContent = document.documentElement.dataset.kind || "—";
  }
  designPropsFill = false;
}

export function commitDesignDocTitle() {
  if (designPropsFill || !isDesignKindActive()) return;
  if (!diagramSourceEl) return;
  var next = designDocTitleEditor ? String(designDocTitleEditor.value || "").replace(/[\r\n]/g, " ").trim() : "";
  var current = diagramTitleFromBody(diagramSourceEl.value) || "";
  if (next === current) return;
  diagramSourceEl.value = updateMermaidTitle(diagramSourceEl.value, next);
  updateDiagramChars();
  emit("scheduleDiagramSave");
  emit("renderDiagram", { fit: false });
}

if (designDocTitleEditor) {
  designDocTitleEditor.addEventListener("change", commitDesignDocTitle);
  designDocTitleEditor.addEventListener("blur", commitDesignDocTitle);
}

if (CanvasInteraction && typeof CanvasInteraction.registerKind === "function") {
  CanvasInteraction.registerKind("design", {
    isHit: function () { return false; },
    clear: function () {},
  });
}

const Design = {
  isDesignKindActive: isDesignKindActive,
  hideDesignFields: hideDesignFields,
  fillDesignProps: fillDesignProps,
  commitDesignDocTitle: commitDesignDocTitle,
};

export default Design;
