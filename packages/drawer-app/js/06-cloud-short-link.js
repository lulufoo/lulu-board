/* drawer-app/06-cloud-short-link.js — #p: fetch then jump to #z: */
async function loadShortLinkByHash(raw) {
  var id = typeof cloudShortLinkIdFromHash === "function" ? cloudShortLinkIdFromHash(raw) : "";
  if (!id) return false;
  if (typeof cloudConfigured !== "function" || !cloudConfigured() || !cloudClient) {
    setStatus("Cloud sync is not configured", true);
    return true;
  }
  var seq = ++cloudLoadSeq;
  setStatus("Loading short link…");
  try {
    var result = await cloudClient.rpc("get_short_link", { p_id: id }).maybeSingle();
    if (result.error) throw result.error;
    if (seq !== cloudLoadSeq) return true;
    if (!result.data || result.data.bmd == null) throw new Error("Short link not found");
    var bmd = String(result.data.bmd);
    if (typeof stripDocumentMeta === "function") bmd = stripDocumentMeta(bmd);
    var token = await encodeDiagramHash(bmd, 1);
    if (seq !== cloudLoadSeq) return true;
    var next = "#" + token;
    if (location.hash !== next) {
      history.replaceState(null, "", location.pathname + location.search + next);
    }
    if (typeof setShareView === "function") setShareView(false);
    if (typeof setShareEdit === "function") setShareEdit(false);
    if (diagramSourceEl) diagramSourceEl.value = bmd;
    diagramDirty = false;
    diagramLocalRev = 1;
    diagramServerRev = 0;
    if (typeof applyDiagramLiveMeta === "function") applyDiagramLiveMeta({ id: "", version: 1 });
    if (typeof updateDiagramChars === "function") updateDiagramChars();
    if (typeof syncSourceDockLabel === "function") syncSourceDockLabel();
    if (typeof showDiagramError === "function") showDiagramError("");
    if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
    setDiagramSyncUI("ok");
    setStatus("Opened from short link");
    return true;
  } catch (error) {
    if (seq !== cloudLoadSeq) return true;
    if (typeof setShareView === "function") setShareView(false);
    if (typeof setShareEdit === "function") setShareEdit(false);
    if (diagramSourceEl) diagramSourceEl.value = "";
    if (typeof applyDiagramLiveMeta === "function") applyDiagramLiveMeta({ id: "" });
    if (typeof renderDiagram === "function") renderDiagram({ fit: false });
    setDiagramSyncUI("error");
    var message = error && error.message ? error.message : "Short link not found";
    if (typeof showDiagramError === "function") showDiagramError(message);
    setStatus(message, true);
    return true;
  }
}
