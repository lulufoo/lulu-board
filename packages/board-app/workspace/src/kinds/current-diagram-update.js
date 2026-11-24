/* One current-page Source transaction. Tool registration and preference wiring live above this layer. */
import { checkCurrentDiagram } from '../state/current-diagram.js';
import { getPageRevision, invalidatePageRevision } from '../core/page-revision.js';
import { validateDiagramSource } from './source-validation.js';
import { renderDiagram, scheduleDiagramSave, flushDiagramSave, setDiagramSyncUI } from './diagram.js';
import {
  diagramSourceEl, diagramDirty, diagramSaveTimer, diagramLocalRev, diagramServerRev,
  updateDiagramChars, setDiagramDirty, setDiagramSaveTimer, setDiagramLocalRev, getDiagramSaveStatus,
} from '../state/shell-state.js';

let updateGuard = function () { return true; };
export function configureCurrentDiagramUpdateGuard(guard) { updateGuard = guard; }

function allowed(signal) {
  try { return !(signal && signal.aborted) && updateGuard() === true; } catch (_error) { return false; }
}
function unavailable() { return { ok: false, code: 'NOT_AVAILABLE', message: 'AI collaboration is not available for this page.' }; }

export async function updateCurrentDiagram(input, options) {
  options = options || {};
  if (!allowed(options.signal)) return unavailable();
  const first = checkCurrentDiagram(input);
  if (!first.ok) return first;
  const candidate = await validateDiagramSource(input.source);
  if (!candidate.ok) return candidate;
  // No await between this final check and replacing Source. An old token can commit only once.
  if (!allowed(options.signal)) return unavailable();
  const current = checkCurrentDiagram(input);
  if (!current.ok) return current;
  if (current.save_status === 'conflict') return { ok: false, code: 'CLOUD_CONFLICT', message: 'Pull the cloud diagram before updating it again.' };
  const previous = { source: current.source, dirty: diagramDirty, localRev: diagramLocalRev, status: current.save_status };
  clearTimeout(diagramSaveTimer);
  setDiagramSaveTimer(null);
  diagramSourceEl.value = candidate.source;
  updateDiagramChars();
  // Even a same-Source update consumes its read token.
  invalidatePageRevision();
  setDiagramDirty(true);
  setDiagramSyncUI('saving');
  const appliedRevision = getPageRevision();
  const applied = { diagram_id: current.diagram_id, expected_revision: appliedRevision };
  const rendered = await renderDiagram({ fit: false });
  const stillOwned = checkCurrentDiagram(applied);
  if (!rendered || !rendered.ok) {
    if (stillOwned.ok) {
      diagramSourceEl.value = previous.source;
      updateDiagramChars();
      const restoredRevision = getPageRevision();
      setDiagramDirty(previous.dirty);
      setDiagramLocalRev(previous.dirty ? Math.max(previous.localRev, Number(diagramServerRev) + 1) : diagramServerRev);
      setDiagramSyncUI(previous.status === 'saved' ? 'ok' : previous.status);
      await renderDiagram({ fit: false });
      if (previous.dirty && checkCurrentDiagram({ diagram_id: current.diagram_id, expected_revision: restoredRevision }).ok) scheduleDiagramSave();
      return { ok: false, code: 'RENDER_FAILED', message: 'The new Source could not be rendered. The previous Source was restored.',
        diagram_id: current.diagram_id, revision: restoredRevision, save_status: previous.status, source_changed: false, rolled_back: true };
    }
    return { ok: false, code: rendered && rendered.superseded ? 'STALE_REVISION' : 'RENDER_FAILED',
      message: 'Source changed, then the page changed again before rendering completed. Later edits were preserved.',
      diagram_id: current.diagram_id, revision: appliedRevision, save_status: 'saving', source_changed: true };
  }
  if (!stillOwned.ok) return { ok: false, code: stillOwned.code, message: 'Source was updated, then the page changed again. Read it again before updating.',
    diagram_id: current.diagram_id, revision: appliedRevision, save_status: 'saving', source_changed: true };
  scheduleDiagramSave();
  const saved = await flushDiagramSave(Object.assign({ detailed: true }, applied));
  if (saved && !saved.ok) return { ok: false, code: saved.code || 'SAVE_FAILED',
    message: 'Source was updated, but cloud saving did not complete: ' + saved.message,
    diagram_id: current.diagram_id, revision: appliedRevision, save_status: saved.save_status || 'error', source_changed: true };
  return { ok: true, diagram_id: current.diagram_id, revision: appliedRevision,
    save_status: saved && saved.save_status || (checkCurrentDiagram(applied).ok ? getDiagramSaveStatus() : 'saving'),
    superseded: !!(saved && saved.superseded), detached: !!(saved && saved.detached) };
}
