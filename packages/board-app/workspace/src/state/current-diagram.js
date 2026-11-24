/* Current-page read/check port. Cloud eligibility is injected by the composition root. */
import { cloudDiagramIdFromHash } from '../core/cloud-route.js';
import DrawerStyleLine from '../core/style-line.js';
import { getPageRevision, invalidatePageRevision } from '../core/page-revision.js';
import { diagramSourceEl, liveDiagramId, observeDiagramSource, getDiagramSaveStatus } from './shell-state.js';

let readContext = function () { return null; };

export function configureCurrentDiagramContext(reader) {
  readContext = reader;
  invalidatePageRevision();
}

function refusal(code, message) { return { ok: false, code: code, message: message }; }

export function getCurrentDiagram(input) {
  observeDiagramSource();
  const context = readContext();
  const routeId = cloudDiagramIdFromHash(typeof location === 'undefined' ? '' : location.hash);
  if (!routeId || !context || !context.signedIn || !context.canEdit) {
    return refusal('NOT_AVAILABLE', 'Open a cloud diagram you can edit while signed in.');
  }
  if (!context.ready || !liveDiagramId || routeId !== liveDiagramId || !diagramSourceEl) {
    return refusal('TARGET_NOT_READY', 'Wait for the current cloud diagram to finish loading.');
  }
  if (!input || typeof input.diagram_id !== 'string' || input.diagram_id !== liveDiagramId) {
    return refusal('DIAGRAM_MISMATCH', 'diagram_id must match the diagram currently loaded in this page.');
  }
  const source = String(diagramSourceEl.value);
  const kind = DrawerStyleLine.bodyKind(source);
  if (kind !== 'boxes' && kind !== 'sketch' && kind !== 'flowchart' && kind !== 'mindmap' && !DrawerStyleLine.isDesignKind(kind)) {
    return refusal('NOT_AVAILABLE', 'The current Source is not a supported diagram kind.');
  }
  return {
    ok: true,
    diagram_id: liveDiagramId,
    kind: kind,
    source: source,
    revision: getPageRevision(),
    save_status: getDiagramSaveStatus(),
  };
}

export function checkCurrentDiagram(input) {
  const current = getCurrentDiagram(input);
  if (!current.ok) return current;
  if (typeof input.expected_revision !== 'string' || input.expected_revision !== current.revision) {
    return refusal('STALE_REVISION', 'The page draft changed. Read the current diagram again before updating.');
  }
  return current;
}
