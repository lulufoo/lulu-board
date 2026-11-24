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

import { configureCurrentDiagramContext } from './state/current-diagram.js';
import { cloudClient, cloudSession, cloudPlusDraftActive, cloudDiagramReady } from './cloud/cloud-state.js';
import { isShareGuest } from './cloud/cloud-share.js';
import { cloudHasSaveConflict } from './cloud/cloud-sync.js';
import { invalidatePageRevision } from './core/page-revision.js';

configureCurrentDiagramContext(function () {
  return {
    signedIn: !!(cloudSession && cloudSession.user && cloudSession.user.id),
    canEdit: !!cloudClient && !cloudPlusDraftActive && !isShareGuest(),
    ready: cloudDiagramReady,
    conflict: cloudHasSaveConflict(),
  };
});
window.addEventListener('hashchange', invalidatePageRevision);
