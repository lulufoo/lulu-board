/* drawer-app/06-cloud-group-tabs.js — group tab chrome on the canvas */
function sortBoardRowsByGroupOrder(boardRows, memberships) {
  var orderOf = {};
  (memberships || []).forEach(function (row) {
    if (row && row.graph_id) orderOf[row.graph_id] = Number(row.sort_order);
  });
  function rank(row) {
    var n = orderOf[row && row.graph_id];
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  }
  return (boardRows || []).slice().sort(function (a, b) {
    if (rank(a) !== rank(b)) return rank(a) < rank(b) ? -1 : 1;
    return String(a && a.graph_id || "").localeCompare(String(b && b.graph_id || ""));
  });
}

function cloudMembersInclude(boardId, groupId, members) {
  var id = String(boardId || "");
  if (!id || !groupId) return false;
  var rows = members || [];
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i] && rows[i].graph_id === id) return true;
  }
  return false;
}

// Group tab label: title comes only from getBoardTitle (06-cloud-sync), read
// again on hover/focus so an unsaved rename shows at once.
function cloudLabelGroupTab(btn, row, number) {
  var t = typeof getBoardTitle === "function" ? getBoardTitle(row.graph_id, row.title) : (row.title || "Untitled");
  btn.setAttribute("aria-label", "Board " + number + ": " + t);
  return t;
}

// Self-drawn chrome tip: shows at once left of a button (native title waits on
// the OS delay). One fixed node on body so no container can clip it. Shared by
// the group number tabs and the cloud save button.
var chromeTipEl = null;
var chromeTipHideTimer = null;

function chromeTip() {
  if (chromeTipEl && chromeTipEl.isConnected) return chromeTipEl;
  chromeTipEl = document.createElement("div");
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
  tip.textContent = text;
  var r = btn.getBoundingClientRect();
  tip.style.top = (r.top + r.height / 2) + "px";
  var rail = edge ? edge.getBoundingClientRect() : r;
  tip.style.right = (window.innerWidth - Math.min(r.left, rail.left) + 6) + "px";
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
  chromeTipHideTimer = setTimeout(function () { tip.classList.remove("is-on"); }, 60);
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

function cloudKnownGroupBoard(boardId) {
  return cloudMembersInclude(boardId, cloudGroupId, cloudGroupMembers);
}

function cloudGroupTabsVisible() {
  if (typeof isShareGuest === "function" && isShareGuest()) return false;
  if (!cloudSession || !cloudSession.user) return false;
  if (!cloudGroupId || !cloudGroupMembers.length) return false;
  if (!cloudPlusDraft && !cloudVelaId()) return false;
  return true;
}

function blankPlusDraftSource(kind) {
  if (kind === "flowchart" && typeof blankHashFlowchartSource === "function") {
    return blankHashFlowchartSource("Untitled");
  }
  if (kind === "mindmap" && typeof blankHashMindmapSource === "function") {
    return blankHashMindmapSource("Untitled");
  }
  return typeof blankHashBoardSource === "function"
    ? blankHashBoardSource("Untitled")
    : "board \"Untitled\"\n";
}

function cloudClearPlusDraftSlot() {
  cloudPlusDraft = false;
  cloudPlusDraftActive = false;
  cloudPlusDraftSource = "";
  cloudPlusDraftRev = 1;
}

function cloudClearDirtyLeave() {
  if (typeof boardSaveTimer !== "undefined") {
    clearTimeout(boardSaveTimer);
    boardSaveTimer = null;
  }
  boardDirty = false;
}

function cloudParkPlusDraft() {
  if (!cloudPlusDraft || !cloudPlusDraftActive) return;
  if (typeof boardSaveTimer !== "undefined") {
    clearTimeout(boardSaveTimer);
    boardSaveTimer = null;
  }
  cloudPlusDraftSource = velaSourceEl ? String(velaSourceEl.value || "") : "";
  cloudPlusDraftRev = Number(velaLocalRev) || 1;
  cloudPlusDraftActive = false;
}

function appendGroupDropLine(root, edge) {
  var line = document.createElement("div");
  line.className = "group-tab-drop-line" + (edge ? " is-edge " + edge : "");
  line.setAttribute("aria-hidden", "true");
  root.appendChild(line);
}

function renderCloudGroupTabs() {
  var root = document.getElementById("vela-group-tabs");
  if (!root) return;
  var show = cloudGroupTabsVisible();
  root.hidden = !show;
  root.innerHTML = "";
  clearChromeTip();
  if (!show) return;
  var viewingDraft = !!cloudPlusDraftActive;
  var current = viewingDraft ? "" : cloudVelaId();
  var last = cloudGroupMembers.length - 1;
  if (last >= 0) appendGroupDropLine(root, "is-start");
  cloudGroupMembers.forEach(function (row, index) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-tab";
    btn.textContent = String(index + 1);
    btn.dataset.boardId = row.graph_id;
    btn.draggable = true;
    cloudLabelGroupTab(btn, row, index + 1);
    var relabel = function () { return cloudLabelGroupTab(btn, row, index + 1); };
    bindGroupTabTip(btn, relabel);
    btn.setAttribute("aria-current", !viewingDraft && row.graph_id === current ? "true" : "false");
    btn.classList.toggle("is-active", !viewingDraft && row.graph_id === current);
    btn.addEventListener("click", function () { void cloudSwitchToBoard(row.graph_id); });
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
  cloudGroupId = "";
  cloudGroupMembers = [];
  cloudSiblingBoardIds = [];
  cloudClearPlusDraftSlot();
  renderCloudGroupTabs();
}

async function cloudConfirmLeaveBoard() {
  if (cloudPlusDraftActive) return true;
  if (boardDirty && cloudVelaId()) {
    if (typeof askConfirm === "function") {
      return askConfirm({
        title: "Not saved yet",
        copy: "Switch anyway?",
        ok: "Switch",
        cancel: "Cancel",
      });
    }
    return true;
  }
  return true;
}

async function refreshCloudGroupMembers(boardId) {
  var id = String(boardId || "");
  cloudSiblingBoardIds = [];
  if (!cloudClient || !id) {
    if (!cloudPlusDraft) {
      cloudGroupId = "";
      cloudGroupMembers = [];
    }
    renderCloudGroupTabs();
    return;
  }
  var members = await cloudClient.from("graphs").select("graph_id,group_id,sort_order,title");
  if (members.error) {
    renderCloudGroupTabs();
    return;
  }
  var rows = members.data || [];
  cloudSiblingBoardIds = loadSiblingBoardIds(id, rows);
  var groupId = "";
  rows.forEach(function (row) {
    if (row && row.graph_id === id) groupId = row.group_id;
  });
  if (!groupId) {
    if (!cloudPlusDraft) {
      cloudGroupId = "";
      cloudGroupMembers = [];
    }
    renderCloudGroupTabs();
    return;
  }
  if (cloudPlusDraft && cloudGroupId && groupId !== cloudGroupId) {
    cloudClearPlusDraftSlot();
  }
  cloudGroupId = groupId;
  var inGroup = rows.filter(function (row) {
    return row && row.group_id === groupId && row.graph_id;
  }).map(function (row) {
    return { graph_id: row.graph_id, title: row.title || "" };
  });
  cloudGroupMembers = sortBoardRowsByGroupOrder(inGroup, rows);
  renderCloudGroupTabs();
}

function cloudOpenBoardById(boardId) {
  var id = String(boardId || "");
  if (!id) return;
  cloudSetBoardHash(id, true);
  if (typeof loadCloudVelaByHash !== "function") return;
  var hash = typeof cloudBoardHash === "function" ? cloudBoardHash(id) : "#b:" + id;
  void loadCloudVelaByHash(hash);
}

async function cloudSwitchToBoard(boardId) {
  var id = String(boardId || "");
  if (!id) return;
  if (cloudPlusDraftActive) {
    cloudParkPlusDraft();
    cloudOpenBoardById(id);
    return;
  }
  if (id === cloudVelaId()) return;
  if (!(await cloudConfirmLeaveBoard())) return;
  if (boardDirty && cloudVelaId() && typeof cloudParkDirtyBoard === "function") {
    cloudParkDirtyBoard();
  }
  cloudClearDirtyLeave();
  cloudOpenBoardById(id);
}

async function cloudSwitchToPlusDraft() {
  if (!cloudPlusDraft || cloudPlusDraftActive) return;
  if (!(await cloudConfirmLeaveBoard())) return;
  if (boardDirty && cloudVelaId() && typeof cloudParkDirtyBoard === "function") {
    cloudParkDirtyBoard();
  }
  cloudClearDirtyLeave();
  cloudPlusDraftActive = true;
  if (velaSourceEl) {
    velaSourceEl.value = cloudPlusDraftSource || blankPlusDraftSource();
    delete velaSourceEl.dataset.boardSelectionKey;
    delete velaSourceEl.dataset.boardEdgeSelectionKey;
  }
  velaLocalRev = Number(cloudPlusDraftRev) || 1;
  boardServerRev = 0;
  if (typeof applyBoardLiveMeta === "function") {
    applyBoardLiveMeta({
      id: "",
      version: velaLocalRev,
    });
  }
  if (typeof rememberOwnerShareId === "function") rememberOwnerShareId("");
  if (typeof renderVela === "function") renderVela({ fit: false });
  if (typeof saveVelaToHash === "function") await saveVelaToHash({ bump: false });
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
  renderCloudGroupTabs();
}

async function cloudStartPlusDraft() {
  if (cloudPlusDraft) {
    if (!cloudPlusDraftActive) void cloudSwitchToPlusDraft();
    else renderCloudGroupTabs();
    return;
  }
  if (!cloudGroupId || !cloudSession || !cloudSession.user) return;
  if (typeof isShareGuest === "function" && isShareGuest()) return;
  if (!(await cloudConfirmLeaveBoard())) return;
  if (typeof openCreateKindDialog !== "function") return;
  openCreateKindDialog({
    onPick: function (kind) { void cloudCommitPlusDraft(kind); },
    onCancel: function () {},
  });
}

async function cloudCommitPlusDraft(kind) {
  if (typeof window.shellCloseDrawer === "function") window.shellCloseDrawer();
  if (cloudPlusDraft) return;
  if (boardDirty && cloudVelaId() && typeof cloudParkDirtyBoard === "function") {
    cloudParkDirtyBoard();
  }
  cloudClearDirtyLeave();
  cloudPlusDraft = true;
  cloudPlusDraftActive = true;
  cloudPlusDraftSource = blankPlusDraftSource(kind);
  cloudPlusDraftRev = 1;
  if (velaSourceEl) {
    velaSourceEl.value = cloudPlusDraftSource;
    delete velaSourceEl.dataset.boardSelectionKey;
    delete velaSourceEl.dataset.boardEdgeSelectionKey;
  }
  velaLocalRev = 1;
  boardServerRev = 0;
  if (typeof applyBoardLiveMeta === "function") {
    applyBoardLiveMeta({ id: "", version: 1 });
  }
  if (typeof rememberOwnerShareId === "function") rememberOwnerShareId("");
  if (typeof renderVela === "function") renderVela({ fit: false });
  if (typeof saveVelaToHash === "function") await saveVelaToHash({ bump: false });
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
  renderCloudGroupTabs();
  setStatus("New diagram in this group");
}
