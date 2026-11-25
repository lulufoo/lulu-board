/* Composition root. Eval order matches the old leftover concat. */
export * from './index.js';
import './chrome/canvas-view.js';
import './chrome/confirm.js';
import './chrome/create-kind-dialog.js';
import './chrome/chrome-boot.js';
import './chrome/source-lines.js';
import './chrome/shell-drawer.js';
import './chrome/share-dialog.js';
import './chrome/settings-dialog.js';
import './chrome/shell-tabs.js';
import './chrome/shortcuts.js';
import './chrome/source-style.js';
import './chrome/theme-picker.js';
import './chrome/native-selects.js';

import { configureCurrentDiagramContext, getCurrentDiagram } from './state/current-diagram.js';
import { cloudClient, cloudSession, cloudPlusDraftActive, cloudDiagramReady, cloudLoadSeq } from './cloud/cloud-state.js';
import { isShareGuest } from './cloud/cloud-share.js';
import { cloudHasSaveConflict } from './cloud/cloud-sync.js';
import { invalidatePageRevision, subscribePageRevision } from './core/page-revision.js';
import { getWebMcpEnabled, subscribeWebMcpPreference } from './core/webmcp-preference.js';
import { liveDiagramId } from './state/shell-state.js';
import { updateCurrentDiagram, configureCurrentDiagramUpdateGuard } from './kinds/current-diagram-update.js';
import { createWebMcpLifecycle } from './chrome/webmcp.js';

configureCurrentDiagramContext(function () {
  return {
    signedIn: !!(cloudSession && cloudSession.user && cloudSession.user.id),
    canEdit: !!cloudClient && !cloudPlusDraftActive && !isShareGuest(),
    ready: cloudDiagramReady,
    conflict: cloudHasSaveConflict(),
  };
});
window.addEventListener('hashchange', invalidatePageRevision);

// Preference is restored synchronously by its module, before registration is considered.
function webMcpTarget() {
  if (!getWebMcpEnabled()) return null;
  const current = getCurrentDiagram({ diagram_id: liveDiagramId });
  return current.ok ? JSON.stringify([cloudSession.user.id, cloudLoadSeq, current.diagram_id]) : null;
}
configureCurrentDiagramUpdateGuard(function () { return !!webMcpTarget(); });
const webMcpLifecycle = createWebMcpLifecycle({
  getModelContext: function () { return document.modelContext; },
  getTarget: webMcpTarget,
  readDiagram: getCurrentDiagram,
  updateDiagram: updateCurrentDiagram,
});
let webMcpSyncQueued = false;
subscribePageRevision(function () {
  // Setters can invalidate before publishing their next state. Reconcile once the
  // synchronous transition is complete; execute guards still read state immediately.
  if (webMcpSyncQueued) return;
  webMcpSyncQueued = true;
  Promise.resolve().then(function () { webMcpSyncQueued = false; webMcpLifecycle.reconcile(); });
});
subscribeWebMcpPreference(function () { webMcpLifecycle.reconcile(); });
