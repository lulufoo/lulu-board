/* Shared cloud session / draft / cache. Writes go through setters. */
import { cloudDiagramIdFromHash } from '../core/cloud-route.js';
import { invalidatePageRevision } from '../core/page-revision.js';
import { register } from '../core/hooks.js';
import { liveDiagramId } from '../state/shell-state.js';

export let cloudClient = null;
export let cloudSession = null;
export let cloudSessionReady = Promise.resolve(null);
export let cloudDiagramReady = false;
let cloudDiagramView = null;
let cloudHadAuthenticatedSession = false;
export let cloudLoadSeq = 0;
export let cloudSaveSeq = 0;
let cloudSiblingDiagramIds = [];
export let cloudGroupId = "";
export let cloudGroupMembers = [];
export let cloudPlusDraft = false;
export let cloudPlusDraftActive = false;
export let cloudPlusDraftSource = "";
export let cloudPlusDraftRev = 1;
export let cloudDiagramCache = {};
export let ownerShareId = "";
let ownerShareRole = "view";
let ownerIsPublic = false;
export let chromeTipEl = null;
export let chromeTipHideTimer = null;
export let cloudRequestedGroupId = "";
export let cloudTabDragId = "";
export let cloudTabDropAfter = false;
export let cloudTabDropId = "";

export function setCloudClient(v) { cloudClient = v; }
export function setCloudSession(v) {
  var before = cloudSession && cloudSession.user && cloudSession.user.id || '';
  var after = v && v.user && v.user.id || '';
  if (before !== after) {
    setCloudDiagramReady(false);
    invalidatePageRevision();
    cloudDiagramCache = {};
    // Initial session restoration belongs to the first pending open, not an old identity.
    if (cloudHadAuthenticatedSession) cloudLoadSeq += 1;
    cloudSaveSeq += 1;
  }
  cloudSession = v;
  if (after) cloudHadAuthenticatedSession = true;
}
export function setCloudDiagramReady(v) {
  if (!v) cloudDiagramView = null;
  if (cloudDiagramReady !== !!v) invalidatePageRevision();
  cloudDiagramReady = !!v;
}
export function beginCloudDiagramView(diagramId) {
  setCloudDiagramReady(false);
  cloudDiagramView = { diagramId: diagramId, sequence: cloudLoadSeq, owner: cloudSession && cloudSession.user && cloudSession.user.id };
}
export function captureCloudDiagramView() {
  var view = cloudDiagramView;
  return view && view.sequence === cloudLoadSeq && view.diagramId === liveDiagramId
    && view.diagramId === cloudDiagramId() && cloudSession && cloudSession.user && view.owner === cloudSession.user.id ? view : null;
}
export function completeCloudDiagramView(view) {
  if (!view || view !== captureCloudDiagramView()) return false;
  // Any current successful render may finish this loaded view, including a human replacement render.
  cloudDiagramView = null;
  setCloudDiagramReady(true);
  return true;
}
export function setCloudSessionReady(v) { cloudSessionReady = v; }
export function bumpCloudLoadSeq() { cloudLoadSeq += 1; setCloudDiagramReady(false); invalidatePageRevision(); return cloudLoadSeq; }
export function bumpCloudSaveSeq() { cloudSaveSeq += 1; return cloudSaveSeq; }
export function setCloudSiblingDiagramIds(v) { cloudSiblingDiagramIds = v; }
export function setCloudGroupId(v) { cloudGroupId = v; }
export function setCloudGroupMembers(v) { cloudGroupMembers = v; }
export function setCloudPlusDraft(v) { cloudPlusDraft = !!v; }
export function setCloudPlusDraftActive(v) { cloudPlusDraftActive = !!v; }
export function setCloudPlusDraftSource(v) { cloudPlusDraftSource = v; }
export function setCloudPlusDraftRev(v) { cloudPlusDraftRev = v; }
export function setCloudDiagramCache(v) { cloudDiagramCache = v; }
export function setOwnerShareId(v) { ownerShareId = v; }
export function setOwnerShareRole(v) { ownerShareRole = v; }
export function setOwnerIsPublic(v) { ownerIsPublic = !!v; }
export function setChromeTipEl(v) { chromeTipEl = v; }
export function setChromeTipHideTimer(v) { chromeTipHideTimer = v; }
export function setCloudRequestedGroupId(v) { cloudRequestedGroupId = v; }
export function setCloudTabDragId(v) { cloudTabDragId = v; }
export function setCloudTabDropAfter(v) { cloudTabDropAfter = !!v; }
export function setCloudTabDropId(v) { cloudTabDropId = v; }

export function cloudDiagramId() {
  return cloudDiagramIdFromHash(typeof location !== "undefined" ? location.hash : "");
}

register('diagramViewContext', captureCloudDiagramView);
register('diagramViewReady', completeCloudDiagramView);
