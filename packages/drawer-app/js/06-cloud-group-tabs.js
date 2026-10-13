/* drawer-app/06-cloud-group-tabs.js — group tab chrome on the canvas */
function sortBoardRowsByGroupOrder(boardRows, memberships) {
  var orderOf = {};
  (memberships || []).forEach(function (row) {
    if (row && row.board_id) orderOf[row.board_id] = Number(row.sort_order);
  });
  function rank(row) {
    var n = orderOf[row && row.board_id];
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  }
  return (boardRows || []).slice().sort(function (a, b) {
    if (rank(a) !== rank(b)) return rank(a) < rank(b) ? -1 : 1;
    return String(a && a.board_id || "").localeCompare(String(b && b.board_id || ""));
  });
}

function cloudMembersInclude(boardId, groupId, members) {
  var id = String(boardId || "");
  if (!id || !groupId) return false;
  var rows = members || [];
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i] && rows[i].board_id === id) return true;
  }
  return false;
}

// Group tab label: title comes only from getBoardTitle (06-cloud-sync), read
// again on hover/focus so an unsaved rename shows at once.
function cloudLabelGroupTab(btn, row, number) {
  var t = typeof getBoardTitle === "function" ? getBoardTitle(row.board_id, row.title) : (row.title || "Untitled");
  btn.setAttribute("aria-label", "Board " + number + ": " + t);
  return t;
}

// Self-drawn title tip: shows at once left of the number tab (native title
// waits on the OS delay). One fixed node on body so the strip cannot clip it.
var groupTabTipEl = null;
var groupTabTipHideTimer = null;

function groupTabTip() {
  if (groupTabTipEl && groupTabTipEl.isConnected) return groupTabTipEl;
  groupTabTipEl = document.createElement("div");
  groupTabTipEl.className = "group-tab-tip";
  groupTabTipEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(groupTabTipEl);
  return groupTabTipEl;
}

function showGroupTabTip(btn, text) {
  var tip = groupTabTip();
  var wasOn = tip.classList.contains("is-on");
  clearTimeout(groupTabTipHideTimer);
  tip.textContent = text;
  var r = btn.getBoundingClientRect();
  tip.style.top = (r.top + r.height / 2) + "px";
  var rail = btn.parentElement ? btn.parentElement.getBoundingClientRect() : r;
  tip.style.right = (window.innerWidth - Math.min(r.left, rail.left) + 6) + "px";
  if (wasOn) return;
  tip.classList.remove("is-on");
  void tip.offsetWidth;
  tip.classList.add("is-on");
}

function hideGroupTabTip() {
  if (!groupTabTipEl) return;
  var tip = groupTabTipEl;
  clearTimeout(groupTabTipHideTimer);
  // short grace so moving to the next tab swaps text instead of replaying
  groupTabTipHideTimer = setTimeout(function () { tip.classList.remove("is-on"); }, 60);
}

function bindGroupTabTip(btn, label) {
  var show = function () { showGroupTabTip(btn, label()); };
  btn.addEventListener("mouseenter", show);
  btn.addEventListener("focus", show);
  btn.addEventListener("mouseleave", hideGroupTabTip);
  btn.addEventListener("blur", hideGroupTabTip);
  btn.addEventListener("pointerdown", hideGroupTabTip);
  btn.addEventListener("dragstart", hideGroupTabTip);
}

function cloudKnownGroupBoard(boardId) {
  return cloudMembersInclude(boardId, cloudGroupId, cloudGroupMembers);
}

function cloudGroupTabsVisible() {
  if (typeof isShareGuest === "function" && isShareGuest()) return false;
  if (!cloudSession || !cloudSession.user) return false;
  if (!cloudGroupId || !cloudGroupMembers.length) return false;
  if (!cloudPlusDraft && !cloudBoardId()) return false;
  return true;
}

function blankPlusDraftSource() {
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
  cloudPlusDraftSource = boardSourceEl ? String(boardSourceEl.value || "") : "";
  cloudPlusDraftRev = Number(boardLocalRev) || 1;
  cloudPlusDraftActive = false;
}

function appendGroupDropLine(root, edge) {
  var line = document.createElement("div");
  line.className = "group-tab-drop-line" + (edge ? " is-edge " + edge : "");
  line.setAttribute("aria-hidden", "true");
  root.appendChild(line);
}

function renderCloudGroupTabs() {
  var root = document.getElementById("board-group-tabs");
  if (!root) return;
  var show = cloudGroupTabsVisible();
  root.hidden = !show;
  root.innerHTML = "";
  if (groupTabTipEl) groupTabTipEl.classList.remove("is-on");
  if (!show) return;
  var viewingDraft = !!cloudPlusDraftActive;
  var current = viewingDraft ? "" : cloudBoardId();
  var last = cloudGroupMembers.length - 1;
  if (last >= 0) appendGroupDropLine(root, "is-start");
  cloudGroupMembers.forEach(function (row, index) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-tab";
    btn.textContent = String(index + 1);
    btn.dataset.boardId = row.board_id;
    btn.draggable = true;
    cloudLabelGroupTab(btn, row, index + 1);
    var relabel = function () { return cloudLabelGroupTab(btn, row, index + 1); };
    bindGroupTabTip(btn, relabel);
    btn.setAttribute("aria-current", !viewingDraft && row.board_id === current ? "true" : "false");
    btn.classList.toggle("is-active", !viewingDraft && row.board_id === current);
    btn.addEventListener("click", function () { void cloudSwitchToBoard(row.board_id); });
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
  plus.setAttribute("aria-label", "Add board");
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
  if (boardDirty && cloudBoardId()) {
    if (typeof boardAskConfirm === "function") {
      return boardAskConfirm({
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
  var members = await cloudClient.from("boards").select("board_id,group_id,sort_order,title");
  if (members.error) {
    renderCloudGroupTabs();
    return;
  }
  var rows = members.data || [];
  cloudSiblingBoardIds = loadSiblingBoardIds(id, rows);
  var groupId = "";
  rows.forEach(function (row) {
    if (row && row.board_id === id) groupId = row.group_id;
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
    return row && row.group_id === groupId && row.board_id;
  }).map(function (row) {
    return { board_id: row.board_id, title: row.title || "" };
  });
  cloudGroupMembers = sortBoardRowsByGroupOrder(inGroup, rows);
  renderCloudGroupTabs();
}

function cloudOpenBoardById(boardId) {
  var id = String(boardId || "");
  if (!id) return;
  cloudSetBoardHash(id, true);
  if (typeof loadCloudBoardByHash !== "function") return;
  var hash = typeof cloudBoardHash === "function" ? cloudBoardHash(id) : "#b:" + id;
  void loadCloudBoardByHash(hash);
}

async function cloudSwitchToBoard(boardId) {
  var id = String(boardId || "");
  if (!id) return;
  if (cloudPlusDraftActive) {
    cloudParkPlusDraft();
    cloudOpenBoardById(id);
    return;
  }
  if (id === cloudBoardId()) return;
  if (!(await cloudConfirmLeaveBoard())) return;
  if (boardDirty && cloudBoardId() && typeof cloudParkDirtyBoard === "function") {
    cloudParkDirtyBoard();
  }
  cloudClearDirtyLeave();
  cloudOpenBoardById(id);
}

async function cloudSwitchToPlusDraft() {
  if (!cloudPlusDraft || cloudPlusDraftActive) return;
  if (!(await cloudConfirmLeaveBoard())) return;
  if (boardDirty && cloudBoardId() && typeof cloudParkDirtyBoard === "function") {
    cloudParkDirtyBoard();
  }
  cloudClearDirtyLeave();
  cloudPlusDraftActive = true;
  if (boardSourceEl) {
    boardSourceEl.value = cloudPlusDraftSource || blankPlusDraftSource();
    delete boardSourceEl.dataset.boardSelectionKey;
    delete boardSourceEl.dataset.boardEdgeSelectionKey;
  }
  boardLocalRev = Number(cloudPlusDraftRev) || 1;
  boardServerRev = 0;
  if (typeof applyBoardLiveMeta === "function") {
    applyBoardLiveMeta({
      id: "",
      version: boardLocalRev,
    });
  }
  if (typeof rememberOwnerShareId === "function") rememberOwnerShareId("");
  if (typeof renderBoard === "function") renderBoard({ fit: false });
  if (typeof saveBoardToHash === "function") await saveBoardToHash({ bump: false });
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
  if (boardDirty && cloudBoardId() && typeof cloudParkDirtyBoard === "function") {
    cloudParkDirtyBoard();
  }
  cloudClearDirtyLeave();
  cloudPlusDraft = true;
  cloudPlusDraftActive = true;
  cloudPlusDraftSource = blankPlusDraftSource();
  cloudPlusDraftRev = 1;
  if (boardSourceEl) {
    boardSourceEl.value = cloudPlusDraftSource;
    delete boardSourceEl.dataset.boardSelectionKey;
    delete boardSourceEl.dataset.boardEdgeSelectionKey;
  }
  boardLocalRev = 1;
  boardServerRev = 0;
  if (typeof applyBoardLiveMeta === "function") {
    applyBoardLiveMeta({ id: "", version: 1 });
  }
  if (typeof rememberOwnerShareId === "function") rememberOwnerShareId("");
  if (typeof renderBoard === "function") renderBoard({ fit: false });
  if (typeof saveBoardToHash === "function") await saveBoardToHash({ bump: false });
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
  renderCloudGroupTabs();
  setStatus("New board in this group");
}
