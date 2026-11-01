/* Persist Boxes / mermaid style token into the open document. */
import BoxesRender from '../../../boxes/index.js';
import { emit } from '../core/hooks.js';
import DrawerStyleLine from '../core/style-line.js';
import { stripDocumentMeta } from '../core/document-meta.js';
import { diagramSourceEl, updateDiagramChars, showDiagramError } from '../state/shell-state.js';

export function persistMermaidStyle(body, patch) {
  if (!DrawerStyleLine) return body;
  var styled = DrawerStyleLine.splitRendererStyle(body);
  var token = DrawerStyleLine.persistStyleToken(styled.token, patch || {});
  return DrawerStyleLine.joinRendererStyle(token, styled.body);
}

export function persistBoardStyle(patch) {
  if (!diagramSourceEl || !diagramSourceEl.value.trim()) return;
  if (document.documentElement.dataset.drawerMode !== "diagram") return;
  try {
    var raw = diagramSourceEl.value;
    var body = stripDocumentMeta(raw);
    var kind = (DrawerStyleLine && DrawerStyleLine.bodyKind)
      ? DrawerStyleLine.bodyKind(body)
      : "boxes";
    var nextBody;
    if (kind === "sketch" || (DrawerStyleLine && DrawerStyleLine.isMermaidKind
      ? DrawerStyleLine.isMermaidKind(kind)
      : (kind === "flowchart" || kind === "mindmap" || kind === "mermaid-unsupported"))) {
      if (!patch || (patch.appearance == null && patch.font_size == null && !Object.prototype.hasOwnProperty.call(patch, "viewport"))) return;
      nextBody = persistMermaidStyle(body, patch);
    } else {
      if (typeof BoxesRender === "undefined" || typeof BoxesRender.updateStyle !== "function") return;
      nextBody = BoxesRender.updateStyle(body, patch || {});
    }
    var next = nextBody;
    if (next !== diagramSourceEl.value) {
      diagramSourceEl.value = next;
      updateDiagramChars();
      emit("scheduleDiagramSave");
    }
  } catch (err) { showDiagramError(err instanceof Error ? err.message : String(err)); }
}
