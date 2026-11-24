/* Shared cloud session / draft / cache. Writes go through setters. */
import { cloudDiagramIdFromHash } from '../core/cloud-route.js';
import { invalidatePageRevision } from '../core/page-revision.js';

export let cloudClient = null;
export let cloudSession = null;
export let cloudSessionReady = Promise.resolve(null);
export let cloudDiagramReady = false;
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
  if (cloudDiagramReady !== !!v) invalidatePageRevision();
  cloudDiagramReady = !!v;
}
export function completeCloudDiagramView(sequence) {
  if (sequence !== cloudLoadSeq) return false;
  // Render hand-off only in LB-763. LB-764 must move this signal to its shared render
  // completion boundary for cloud open, Pull and create, as well as AI updates.
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
