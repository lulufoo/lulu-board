/* drawer-app/06-cloud-group-tabs.js — group tab chrome on the canvas */
function sortBoardRowsByCreatedAt(rows) {
  return (rows || []).slice().sort(function (a, b) {
    var ta = Date.parse(a && a.created_at || "") || 0;
    var tb = Date.parse(b && b.created_at || "") || 0;
    if (ta !== tb) return ta - tb;
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

function renderCloudGroupTabs() {
  var root = document.getElementById("board-group-tabs");
  if (!root) return;
  var show = cloudGroupTabsVisible();
  root.hidden = !show;
  root.innerHTML = "";
  if (!show) return;
  var viewingDraft = !!cloudPlusDraftActive;
  var current = viewingDraft ? "" : cloudBoardId();
  cloudGroupMembers.forEach(function (row, index) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-tab";
    btn.textContent = String(index + 1);
    btn.dataset.boardId = row.board_id;
    btn.setAttribute("aria-label", "Board " + (index + 1));
    btn.setAttribute("aria-current", !viewingDraft && row.board_id === current ? "true" : "false");
    btn.classList.toggle("is-active", !viewingDraft && row.board_id === current);
    btn.addEventListener("click", function () { cloudSwitchToBoard(row.board_id); });
    root.appendChild(btn);
  });
  if (cloudPlusDraft) {
    var draftNo = cloudGroupMembers.length + 1;
    var draft = document.createElement("button");
    draft.type = "button";
    draft.className = "group-tab";
    draft.textContent = String(draftNo);
    draft.setAttribute("aria-label", "Board " + draftNo);
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

function cloudConfirmLeaveBoard() {
  if (cloudPlusDraftActive) return true;
  if (boardDirty && cloudBoardId()) {
    return window.confirm("Leave without saving?");
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
  var members = await cloudClient.from("group_members").select("board_id,group_id");
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
  var ids = [];
  rows.forEach(function (row) {
    if (row && row.group_id === groupId && row.board_id) ids.push(row.board_id);
  });
  var boards = await cloudClient.from("boards").select("board_id,created_at").in("board_id", ids);
  if (boards.error) {
    renderCloudGroupTabs();
    return;
  }
  cloudGroupMembers = sortBoardRowsByCreatedAt(boards.data || []);
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

function cloudSwitchToBoard(boardId) {
  var id = String(boardId || "");
  if (!id) return;
  if (cloudPlusDraftActive) {
    cloudParkPlusDraft();
    cloudOpenBoardById(id);
    return;
  }
  if (id === cloudBoardId()) return;
  if (!cloudConfirmLeaveBoard()) return;
  cloudClearDirtyLeave();
  cloudOpenBoardById(id);
}

async function cloudSwitchToPlusDraft() {
  if (!cloudPlusDraft || cloudPlusDraftActive) return;
  if (!cloudConfirmLeaveBoard()) return;
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
      title: typeof boardTitleFromBody === "function"
        ? boardTitleFromBody(boardSourceEl ? boardSourceEl.value : cloudPlusDraftSource)
        : "Untitled",
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
  if (!cloudConfirmLeaveBoard()) return;
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
    applyBoardLiveMeta({ id: "", title: "Untitled", version: 1 });
  }
  if (typeof rememberOwnerShareId === "function") rememberOwnerShareId("");
  if (typeof renderBoard === "function") renderBoard({ fit: false });
  if (typeof saveBoardToHash === "function") await saveBoardToHash({ bump: false });
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
  renderCloudGroupTabs();
  setStatus("New board in this group");
}
