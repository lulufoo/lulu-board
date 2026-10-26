/* Cloud layer. Chrome leftover is reached through hooks. */
import { register, emit, call } from '../core/hooks.js';
import { sentryCount } from '../core/sentry-count.js';
import { stripDocumentMeta, diagramTitleFromBody, newGraphId } from '../core/document-meta.js';
import { loadKindTemplateSource } from '../core/kind-template.js';
import {
  cloudDiagramIdFromHash,
  cloudDiagramHash,
  cloudShareIdFromHash,
  cloudShareHash,
  cloudShortLinkIdFromHash,
} from '../core/cloud-route.js';
import {
  cloudClient,
  cloudSession,
  cloudSessionReady,
  cloudLoadSeq,
  cloudSaveSeq,
  cloudSiblingDiagramIds,
  cloudGroupId,
  cloudGroupMembers,
  cloudPlusDraft,
  cloudPlusDraftActive,
  cloudPlusDraftSource,
  cloudPlusDraftRev,
  cloudDiagramCache,
  ownerShareId,
  ownerShareRole,
  ownerIsPublic,
  chromeTipEl,
  chromeTipHideTimer,
  cloudRequestedGroupId,
  cloudTabDragId,
  cloudTabDropAfter,
  cloudTabDropId,
  setCloudClient,
  setCloudSession,
  setCloudSessionReady,
  bumpCloudLoadSeq,
  bumpCloudSaveSeq,
  setCloudSiblingDiagramIds,
  setCloudGroupId,
  setCloudGroupMembers,
  setCloudPlusDraft,
  setCloudPlusDraftActive,
  setCloudPlusDraftSource,
  setCloudPlusDraftRev,
  setCloudDiagramCache,
  setOwnerShareId,
  setOwnerShareRole,
  setOwnerIsPublic,
  setChromeTipEl,
  setChromeTipHideTimer,
  setCloudRequestedGroupId,
  setCloudTabDragId,
  setCloudTabDropAfter,
  setCloudTabDropId,
  cloudDiagramId,
} from './cloud-state.js';
import {
  $,
  diagramSourceEl,
  diagramLocalRev,
  diagramServerRev,
  diagramDirty,
  diagramSaveTimer,
  liveDiagramId,
  shellGroups,
  setStatus,
  showDiagramError,
  updateDiagramChars,
  applyDiagramLiveMeta,
  syncSourceDockLabel,
  setDiagramDirty,
  setDiagramLocalRev,
  setDiagramServerRev,
  setDiagramSaveTimer,
} from '../state/shell-state.js';

import {
  cloudSetDiagramHash,
  loadCloudDiagramByHash,
  cloudParkDirtyDiagram,
  syncCloudSaveChrome,
  getDiagramTitle,
} from './cloud-sync.js';

/* drawer-app/06-cloud-group-tabs.js — group tab chrome on the canvas */
function sortDiagramRowsByGroupOrder(diagramRows, memberships) {
  var orderOf = {};
  (memberships || []).forEach(function (row) {
    if (row && row.graph_id) orderOf[row.graph_id] = Number(row.sort_order);
  });
  function rank(row) {
    var n = orderOf[row && row.graph_id];
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  }
  return (diagramRows || []).slice().sort(function (a, b) {
    if (rank(a) !== rank(b)) return rank(a) < rank(b) ? -1 : 1;
    return String(a && a.graph_id || "").localeCompare(String(b && b.graph_id || ""));
  });
}

function cloudMembersInclude(diagramId, groupId, members) {
  var id = String(diagramId || "");
  if (!id || !groupId) return false;
  var rows = members || [];
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i] && rows[i].graph_id === id) return true;
  }
  return false;
}

// Group tab label: title comes only from getDiagramTitle (06-cloud-sync), read
// again on hover/focus so an unsaved rename shows at once.
function cloudLabelGroupTab(btn, row, number) {
  var t = call("getDiagramTitle", row.graph_id, row.title) != null ? call("getDiagramTitle", row.graph_id, row.title) : (row.title || "Untitled");
  btn.setAttribute("aria-label", "Board " + number + ": " + t);
  return t;
}

// Self-drawn chrome tip: shows at once left of a button (native title waits on
// the OS delay). One fixed node on body so no container can clip it. Shared by
// the group number tabs and the cloud save button. Long titles wrap; cap 100.
var CHROME_TIP_MAX_CHARS = 100;
var CHROME_TIP_VIEW_MARGIN = 8;
var CHROME_TIP_NUDGE_MS = 3000;

function clipChromeTipText(text) {
  var chars = Array.from(String(text == null ? "" : text));
  return chars.length > CHROME_TIP_MAX_CHARS ? chars.slice(0, CHROME_TIP_MAX_CHARS).join("") : chars.join("");
}

// anchorCenter is the button midpoint. The tip is translated -50%, so this
// value is the tip's vertical center. A wrapped tip stays on the button,
// then shifts just enough to remain inside the viewport.
function chromeTipCenter(anchorCenter, tipHeight, viewHeight) {
  var half = tipHeight / 2;
  var min = CHROME_TIP_VIEW_MARGIN + half;
  var max = viewHeight - CHROME_TIP_VIEW_MARGIN - half;
  if (!(tipHeight > 0) || !(viewHeight > 0)) return anchorCenter;
  if (min > max) return viewHeight / 2;
  if (anchorCenter < min) return min;
  if (anchorCenter > max) return max;
  return anchorCenter;
}

function chromeTip() {
  if (chromeTipEl && chromeTipEl.isConnected) return chromeTipEl;
  setChromeTipEl(document.createElement("div"));
  chromeTipEl.className = "chrome-tip";
  chromeTipEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(chromeTipEl);
  return chromeTipEl;
}

// edge: optional element whose left edge the tip keeps 6px away from
// (the group tab strip); defaults to the button itself.
function showChromeTip(btn, text, edge) {
  var tip = chromeTip();
  var wasOn = tip.classList.contains("is-on");
  clearTimeout(chromeTipHideTimer);
  tip.classList.remove("is-nudge");
  tip.textContent = clipChromeTipText(text);
  var r = btn.getBoundingClientRect();
  var rail = edge ? edge.getBoundingClientRect() : r;
  tip.style.right = (window.innerWidth - Math.min(r.left, rail.left) + 6) + "px";
  var anchor = r.top + r.height / 2;
  tip.style.top = chromeTipCenter(anchor, tip.offsetHeight, window.innerHeight) + "px";
  if (wasOn) return;
  tip.classList.remove("is-on");
  void tip.offsetWidth;
  tip.classList.add("is-on");
}

function hideChromeTip() {
  if (!chromeTipEl) return;
  var tip = chromeTipEl;
  clearTimeout(chromeTipHideTimer);
  // short grace so moving to the next button swaps text instead of replaying
  setChromeTipHideTimer(setTimeout(function () { tip.classList.remove("is-on"); }, 60));
}

function clearChromeTip() {
  if (chromeTipEl) chromeTipEl.classList.remove("is-on");
}

// label() is read on every show; edge() optional, read on every show.
function bindChromeTip(btn, label, edge) {
  var show = function () {
    var text = label();
    if (!text) return;
    showChromeTip(btn, text, edge ? edge() : null);
  };
  btn.addEventListener("mouseenter", show);
  btn.addEventListener("focus", show);
  btn.addEventListener("mouseleave", hideChromeTip);
  btn.addEventListener("blur", hideChromeTip);
  btn.addEventListener("pointerdown", hideChromeTip);
  btn.addEventListener("dragstart", hideChromeTip);
}

function bindGroupTabTip(btn, label) {
  bindChromeTip(btn, label, function () { return btn.parentElement; });
}

// New unsaved diagram: show Create on its own. mouseenter clears this timer
// (hover then owns the tip); pointerdown still hides at once.
function nudgeChromeTip(btn, text) {
  if (!btn || btn.hidden || !text) return;
  showChromeTip(btn, text);
  var tip = chromeTip();
  tip.classList.add("is-nudge");
  var token = String((Number(tip.dataset.nudgeToken) || 0) + 1);
  tip.dataset.nudgeToken = token;
  clearTimeout(chromeTipHideTimer);
  setChromeTipHideTimer(setTimeout(function () {
    if (!chromeTipEl || chromeTipEl.dataset.nudgeToken !== token) return;
    delete chromeTipEl.dataset.nudgeToken;
    var hovering = typeof btn.matches === "function" && (btn.matches(":hover") || btn.matches(":focus-visible"));
    var focused = typeof document !== "undefined" && document.activeElement === btn;
    if (hovering || focused) {
      chromeTipEl.classList.remove("is-nudge");
      return;
    }
    chromeTipEl.classList.remove("is-on");
  }, CHROME_TIP_NUDGE_MS));
}

// Only the uncreated Create label. Measured on the next frame, after the button is shown.
function nudgeUncreatedCreateTip() {
  var save = document.getElementById("btnShellSaveCloud");
  if (!save || typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(function () {
    if (!save.isConnected || save.hidden || save.getAttribute("aria-label") !== "Create") return;
    nudgeChromeTip(save, "Create");
  });
}

function cloudKnownGroupDiagram(diagramId) {
  return cloudMembersInclude(diagramId, cloudGroupId, cloudGroupMembers);
}

function cloudGroupTabsVisible() {
  if (call("isShareGuest")) return false;
  if (!cloudSession || !cloudSession.user) return false;
  if (!cloudGroupId || !cloudGroupMembers.length) return false;
  if (!cloudPlusDraft && !cloudDiagramId()) return false;
  return true;
}

async function blankPlusDraftSource(kind) {
    return loadKindTemplateSource(kind);
}

function cloudClearPlusDraftSlot() {
  setCloudPlusDraft(false);
  setCloudPlusDraftActive(false);
  setCloudPlusDraftSource("");
  setCloudPlusDraftRev(1);
}

function cloudClearDirtyLeave() {
  if (typeof diagramSaveTimer !== "undefined") {
    clearTimeout(diagramSaveTimer);
    setDiagramSaveTimer(null);
  }
  setDiagramDirty(false);
}

function cloudParkPlusDraft() {
  if (!cloudPlusDraft || !cloudPlusDraftActive) return;
  if (typeof diagramSaveTimer !== "undefined") {
    clearTimeout(diagramSaveTimer);
    setDiagramSaveTimer(null);
  }
  setCloudPlusDraftSource(diagramSourceEl ? String(diagramSourceEl.value || "") : "");
  setCloudPlusDraftRev(Number(diagramLocalRev) || 1);
  setCloudPlusDraftActive(false);
}

function appendGroupDropLine(root, edge) {
  var line = document.createElement("div");
  line.className = "group-tab-drop-line" + (edge ? " is-edge " + edge : "");
  line.setAttribute("aria-hidden", "true");
  root.appendChild(line);
}

function renderCloudGroupTabs() {
  var root = document.getElementById("diagram-group-tabs");
  if (!root) return;
  var show = cloudGroupTabsVisible();
  root.hidden = !show;
  root.innerHTML = "";
  clearChromeTip();
  if (!show) return;
  var viewingDraft = !!cloudPlusDraftActive;
  var current = viewingDraft ? "" : cloudDiagramId();
  var last = cloudGroupMembers.length - 1;
  if (last >= 0) appendGroupDropLine(root, "is-start");
  cloudGroupMembers.forEach(function (row, index) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-tab";
    btn.textContent = String(index + 1);
    btn.dataset.diagramId = row.graph_id;
    btn.draggable = true;
    cloudLabelGroupTab(btn, row, index + 1);
    var relabel = function () { return cloudLabelGroupTab(btn, row, index + 1); };
    bindGroupTabTip(btn, relabel);
    btn.setAttribute("aria-current", !viewingDraft && row.graph_id === current ? "true" : "false");
    btn.classList.toggle("is-active", !viewingDraft && row.graph_id === current);
    btn.addEventListener("click", function () { void cloudSwitchToDiagram(row.graph_id); });
    root.appendChild(btn);
    appendGroupDropLine(root, index === last ? "is-end" : "");
  });
  if (cloudPlusDraft) {
    var draftNo = cloudGroupMembers.length + 1;
    var draft = document.createElement("button");
    draft.type = "button";
    draft.className = "group-tab";
    draft.textContent = String(draftNo);
    draft.setAttribute("aria-label", "Board " + draftNo + ": Untitled");
    bindGroupTabTip(draft, function () { return "Untitled"; });
    draft.setAttribute("aria-current", viewingDraft ? "true" : "false");
    draft.classList.toggle("is-active", viewingDraft);
    draft.addEventListener("click", function () { void cloudSwitchToPlusDraft(); });
    root.appendChild(draft);
  }
  var plus = document.createElement("button");
  plus.type = "button";
  plus.className = "group-tab group-tab-plus";
  plus.textContent = "+";
  plus.setAttribute("aria-label", "Add diagram");
  plus.disabled = !!cloudPlusDraft;
  plus.addEventListener("click", function () { void cloudStartPlusDraft(); });
  root.appendChild(plus);
}

function cloudClearGroupTabs() {
  setCloudGroupId("");
  setCloudGroupMembers([]);
  setCloudSiblingDiagramIds([]);
  cloudClearPlusDraftSlot();
  renderCloudGroupTabs();
}

async function cloudConfirmLeaveDiagram() {
  if (cloudPlusDraftActive) return true;
  if (diagramDirty && cloudDiagramId()) {
    return call("askConfirm", {
      title: "Not saved yet",
      copy: "Switch anyway?",
      ok: "Switch",
      cancel: "Cancel",
    });
  }
  return true;
}


function cloudTakeRequestedGroupId() {
  var groupId = cloudRequestedGroupId;
  setCloudRequestedGroupId("");
  return groupId;
}

function cloudCachedGroupShells(diagramId, groupId) {
  var groups = (typeof shellGroups !== "undefined" && shellGroups) || [];
  var found = null;
  groups.forEach(function (group) {
    if (group && groupId && group.groupId === groupId) found = group;
  });
  if (!found) {
    groups.forEach(function (group) {
      if (!found && group && group.diagramIds && group.diagramIds.indexOf(diagramId) >= 0) found = group;
    });
  }
  if (!found || !found.members || !found.members.length) return null;
  var shells = found.members.map(function (row) {
    return {
      graph_id: row.graph_id,
      group_id: row.group_id || found.groupId,
      title: row.title || "",
      sort_order: row.sort_order,
    };
  }).filter(function (row) { return row.graph_id; });
  if (!shells.some(function (row) { return row.graph_id === diagramId; })) return null;
  return shells;
}

async function refreshCloudGroupMembers(diagramId, groupId) {
  var id = String(diagramId || "");
  setCloudSiblingDiagramIds([]);
  if (!cloudClient || !id) {
    if (!cloudPlusDraft) {
      setCloudGroupId("");
      setCloudGroupMembers([]);
    }
    renderCloudGroupTabs();
    return;
  }
  var shellArgs = { p_graph_id: id };
  if (groupId) shellArgs.p_group_id = String(groupId);
  var cachedShells = cloudCachedGroupShells(id, groupId);
  var members = cachedShells
    ? { data: cachedShells, error: null }
    : await cloudClient.rpc("load_group_shells", shellArgs);
  if (members.error) {
    renderCloudGroupTabs();
    return;
  }
  var rows = members.data || [];
  setCloudSiblingDiagramIds(loadSiblingDiagramIds(id, rows));
  var groupId = "";
  rows.forEach(function (row) {
    if (row && row.graph_id === id) groupId = row.group_id;
  });
  if (!groupId) {
    if (!cloudPlusDraft) {
      setCloudGroupId("");
      setCloudGroupMembers([]);
    }
    renderCloudGroupTabs();
    return;
  }
  if (cloudPlusDraft && cloudGroupId && groupId !== cloudGroupId) {
    cloudClearPlusDraftSlot();
  }
  setCloudGroupId(groupId);
  var inGroup = rows.filter(function (row) {
    return row && row.graph_id;
  }).map(function (row) {
    return { graph_id: row.graph_id, title: row.title || "" };
  });
  setCloudGroupMembers(sortDiagramRowsByGroupOrder(inGroup, rows));
  renderCloudGroupTabs();
}

function cloudOpenDiagramById(diagramId) {
  var id = String(diagramId || "");
  if (!id) return;
  cloudSetDiagramHash(id, true);
  
  var hash = cloudDiagramHash(id);
  void loadCloudDiagramByHash(hash);
}

async function cloudSwitchToDiagram(diagramId, groupId) {
  var id = String(diagramId || "");
  if (!id) return;
  var requested = groupId ? String(groupId) : "";
  function openRequested() {
    setCloudRequestedGroupId(requested);
    cloudOpenDiagramById(id);
  }
  if (cloudPlusDraftActive) {
    cloudParkPlusDraft();
    openRequested();
    return;
  }
  if (id === cloudDiagramId()) return;
  if (!(await cloudConfirmLeaveDiagram())) return;
  if (diagramDirty && cloudDiagramId()) {
    cloudParkDirtyDiagram();
  }
  cloudClearDirtyLeave();
  openRequested();
}

async function cloudSwitchToPlusDraft() {
  if (!cloudPlusDraft || cloudPlusDraftActive) return;
  if (!(await cloudConfirmLeaveDiagram())) return;
  if (diagramDirty && cloudDiagramId()) {
    cloudParkDirtyDiagram();
  }
  cloudClearDirtyLeave();
  setCloudPlusDraftActive(true);
  if (diagramSourceEl) {
    diagramSourceEl.value = cloudPlusDraftSource || "";
    delete diagramSourceEl.dataset.boardSelectionKey;
    delete diagramSourceEl.dataset.boardEdgeSelectionKey;
  }
  setDiagramLocalRev(Number(cloudPlusDraftRev) || 1);
  setDiagramServerRev(0);
  applyDiagramLiveMeta({
      id: "",
      version: diagramLocalRev,
    });
  emit("rememberOwnerShareId", "");
  emit("renderDiagram", { fit: false });
  await call("saveDiagramToHash", { bump: false });
  syncCloudSaveChrome();
  renderCloudGroupTabs();
}

async function cloudStartPlusDraft() {
  if (cloudPlusDraft) {
    if (!cloudPlusDraftActive) void cloudSwitchToPlusDraft();
    else renderCloudGroupTabs();
    return;
  }
  if (!cloudGroupId || !cloudSession || !cloudSession.user) return;
  if (call("isShareGuest")) return;
  if (!(await cloudConfirmLeaveDiagram())) return;
    emit("openCreateKindDialog", {
    onPick: function (kind) { emit("applyCreateKindPick", kind, function (picked) { void cloudCommitPlusDraft(picked); }); },
    onCancel: function () {},
  });
}

async function cloudCommitPlusDraft(kind) {
  emit("shellCloseDrawer");
  if (cloudPlusDraft) return;
  if (diagramDirty && cloudDiagramId()) {
    cloudParkDirtyDiagram();
  }
  cloudClearDirtyLeave();
  setCloudPlusDraft(true);
  setCloudPlusDraftActive(true);
  try {
    setCloudPlusDraftSource(await blankPlusDraftSource(kind));
  } catch (err) {
    setCloudPlusDraft(false);
    setCloudPlusDraftActive(false);
    setCloudPlusDraftSource("");
    setStatus(err instanceof Error ? err.message : String(err), true);
    return;
  }
  setCloudPlusDraftRev(1);
  if (diagramSourceEl) {
    diagramSourceEl.value = cloudPlusDraftSource;
    delete diagramSourceEl.dataset.boardSelectionKey;
    delete diagramSourceEl.dataset.boardEdgeSelectionKey;
  }
  setDiagramLocalRev(1);
  setDiagramServerRev(0);
  applyDiagramLiveMeta({ id: "", version: 1 });
  emit("rememberOwnerShareId", "");
  emit("renderDiagram", { fit: false });
  await call("saveDiagramToHash", { bump: false });
  syncCloudSaveChrome();
  renderCloudGroupTabs();
  nudgeUncreatedCreateTip();
  setStatus("New diagram in this group");
}


register("sortDiagramRowsByGroupOrder", sortDiagramRowsByGroupOrder);
register("cloudMembersInclude", cloudMembersInclude);
register("cloudLabelGroupTab", cloudLabelGroupTab);
register("clipChromeTipText", clipChromeTipText);
register("chromeTipCenter", chromeTipCenter);
register("chromeTip", chromeTip);
register("showChromeTip", showChromeTip);
register("hideChromeTip", hideChromeTip);
register("clearChromeTip", clearChromeTip);
register("bindChromeTip", bindChromeTip);
register("bindGroupTabTip", bindGroupTabTip);
register("nudgeChromeTip", nudgeChromeTip);
register("nudgeUncreatedCreateTip", nudgeUncreatedCreateTip);
register("cloudKnownGroupDiagram", cloudKnownGroupDiagram);
register("cloudGroupTabsVisible", cloudGroupTabsVisible);
register("blankPlusDraftSource", blankPlusDraftSource);
register("cloudClearPlusDraftSlot", cloudClearPlusDraftSlot);
register("cloudClearDirtyLeave", cloudClearDirtyLeave);
register("cloudParkPlusDraft", cloudParkPlusDraft);
register("appendGroupDropLine", appendGroupDropLine);
register("renderCloudGroupTabs", renderCloudGroupTabs);
register("cloudClearGroupTabs", cloudClearGroupTabs);
register("cloudConfirmLeaveDiagram", cloudConfirmLeaveDiagram);
register("cloudTakeRequestedGroupId", cloudTakeRequestedGroupId);
register("cloudCachedGroupShells", cloudCachedGroupShells);
register("refreshCloudGroupMembers", refreshCloudGroupMembers);
register("cloudOpenDiagramById", cloudOpenDiagramById);
register("cloudSwitchToDiagram", cloudSwitchToDiagram);
register("cloudSwitchToPlusDraft", cloudSwitchToPlusDraft);
register("cloudStartPlusDraft", cloudStartPlusDraft);
register("cloudCommitPlusDraft", cloudCommitPlusDraft);

export {
  sortDiagramRowsByGroupOrder,
  cloudMembersInclude,
  cloudLabelGroupTab,
  clipChromeTipText,
  chromeTipCenter,
  chromeTip,
  showChromeTip,
  hideChromeTip,
  clearChromeTip,
  bindChromeTip,
  bindGroupTabTip,
  nudgeChromeTip,
  nudgeUncreatedCreateTip,
  cloudKnownGroupDiagram,
  cloudGroupTabsVisible,
  blankPlusDraftSource,
  cloudClearPlusDraftSlot,
  cloudClearDirtyLeave,
  cloudParkPlusDraft,
  appendGroupDropLine,
  renderCloudGroupTabs,
  cloudClearGroupTabs,
  cloudConfirmLeaveDiagram,
  cloudTakeRequestedGroupId,
  cloudCachedGroupShells,
  refreshCloudGroupMembers,
  cloudOpenDiagramById,
  cloudSwitchToDiagram,
  cloudSwitchToPlusDraft,
  cloudStartPlusDraft,
  cloudCommitPlusDraft
};
