/* Persist Boxes / mermaid style token into the open document. */
import BoxesRender from '../../../boxes/index.js';
import { emit } from '../core/hooks.js';
import DrawerStyleLine from '../core/style-line.js';
import { stripDocumentMeta } from '../core/document-meta.js';
import { diagramSourceEl, updateDiagramChars, showDiagramError } from '../state/shell-state.js';

export function persistMermaidStyle(body, patch) {
  if (!DrawerStyleLine) return body;
  var styled = DrawerStyleLine.splitRendererStyle(body);
  var theme = patch && patch.theme != null
    ? DrawerStyleLine.resolveThemeId(patch.theme)
    : DrawerStyleLine.themeFromStyleToken(styled.token);
  var step = patch && patch.type_step != null
    ? DrawerStyleLine.clampMermaidTypeStep(patch.type_step)
    : DrawerStyleLine.typeStepFromStyleToken(styled.token);
  var viewport;
  if (patch && Object.prototype.hasOwnProperty.call(patch, "viewport")) {
    viewport = patch.viewport;
  } else {
    var prev = typeof DrawerStyleLine.decodeStyleTokenJson === "function"
      ? DrawerStyleLine.decodeStyleTokenJson(styled.token)
      : null;
    viewport = prev && (prev.viewport || prev.view);
  }
  var token = DrawerStyleLine.mermaidStyleToken(theme, step, viewport);
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
      if (!patch || (patch.theme == null && patch.type_step == null && !Object.prototype.hasOwnProperty.call(patch, "viewport"))) return;
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
