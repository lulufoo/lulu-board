/* Cloud layer. Chrome leftover is reached through hooks. */
import { register, emit } from '../core/hooks.js';

import { stripDocumentMeta } from '../core/document-meta.js';

import { cloudShortLinkIdFromHash } from '../core/cloud-route.js';
import {
  cloudClient,
  cloudLoadSeq,
  bumpCloudLoadSeq,
} from './cloud-state.js';
import {
  diagramSourceEl,
  setStatus,
  showDiagramError,
  updateDiagramChars,
  applyDiagramLiveMeta,
  syncSourceDockLabel,
  setDiagramDirty,
  setDiagramLocalRev,
  setDiagramServerRev,
} from '../state/shell-state.js';
import { encodeDiagramHash } from '../core/hash-persist.js';
import { cloudConfigured } from './cloud-sync.js';
import { setDiagramSyncUI } from '../kinds/diagram.js';

/* drawer-app/06-cloud-short-link.js — #p: fetch then jump to #z: */
async function loadShortLinkByHash(raw) {
  var id = cloudShortLinkIdFromHash(raw);
  if (!id) return false;
  if (!cloudConfigured() || !cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return true;
  }
  var seq = bumpCloudLoadSeq();
  setStatus("Loading short link…");
  try {
    var result = await cloudClient.rpc("get_short_link", { p_id: id }).maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return true;
    if (!result.data || result.data.bmd == null) throw new Error("Short link not found");
    var bmd = String(result.data.bmd);
    bmd = stripDocumentMeta(bmd);
    var token = await encodeDiagramHash(bmd, 1);
    if (seq !== cloudLoadSeq) return true;
    var next = "#" + token;
    if (location.hash !== next) {
      history.replaceState(null, "", location.pathname + location.search + next);
    }
    emit("setShareView", false);
    emit("setShareEdit", false);
    if (diagramSourceEl) diagramSourceEl.value = bmd;
    setDiagramDirty(false);
    setDiagramLocalRev(1);
    setDiagramServerRev(0);
    applyDiagramLiveMeta({ id: "", version: 1 });
    updateDiagramChars();
    syncSourceDockLabel();
    showDiagramError("");
    emit("renderDiagram", { fit: false, restoreView: true });
    setDiagramSyncUI("ok");
    setStatus("Opened from short link");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    emit("setShareView", false);
    emit("setShareEdit", false);
    if (diagramSourceEl) diagramSourceEl.value = "";
    applyDiagramLiveMeta({ id: "" });
    emit("renderDiagram", { fit: false });
    setDiagramSyncUI("error");
    var message = error && error.message ? error.message : "Short link not found";
    showDiagramError(message);
    setStatus(message, true);
    return true;
  }
}

register("loadShortLinkByHash", loadShortLinkByHash);

