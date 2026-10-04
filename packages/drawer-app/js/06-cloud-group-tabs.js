/* drawer-app/06-cloud-group-tabs.js — group tab chrome on the canvas */
function sortBoardRowsByCreatedAt(rows) {
  return (rows || []).slice().sort(function (a, b) {
    var ta = Date.parse(a && a.created_at || "") || 0;
    var tb = Date.parse(b && b.created_at || "") || 0;
    if (ta !== tb) return ta - tb;
    return String(a && a.board_id || "").localeCompare(String(b && b.board_id || ""));
  });
}

function cloudGroupTabsVisible() {
  if (typeof isShareGuest === "function" && isShareGuest()) return false;
  if (!cloudSession || !cloudSession.user) return false;
  if (!cloudGroupId || !cloudGroupMembers.length) return false;
  if (!cloudPlusDraft && !cloudBoardId()) return false;
  return true;
}

function renderCloudGroupTabs() {
  var root = document.getElementById("board-group-tabs");
  if (!root) return;
  var show = cloudGroupTabsVisible();
  root.hidden = !show;
  root.innerHTML = "";
  if (!show) return;
  var current = cloudPlusDraft ? "" : cloudBoardId();
  cloudGroupMembers.forEach(function (row, index) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-tab";
    btn.textContent = String(index + 1);
    btn.dataset.boardId = row.board_id;
    btn.setAttribute("aria-label", "Board " + (index + 1));
    btn.setAttribute("aria-current", !cloudPlusDraft && row.board_id === current ? "true" : "false");
    btn.classList.toggle("is-active", !cloudPlusDraft && row.board_id === current);
    btn.addEventListener("click", function () { cloudSwitchToBoard(row.board_id); });
    root.appendChild(btn);
  });
  var plus = document.createElement("button");
  plus.type = "button";
  plus.className = "group-tab group-tab-plus";
  plus.textContent = "+";
  plus.setAttribute("aria-label", "Add board");
  plus.classList.toggle("is-active", !!cloudPlusDraft);
  plus.addEventListener("click", function () { cloudStartPlusDraft(); });
  root.appendChild(plus);
}

function cloudClearGroupTabs() {
  cloudGroupId = "";
  cloudGroupMembers = [];
  cloudSiblingBoardIds = [];
  cloudPlusDraft = false;
  renderCloudGroupTabs();
}

function cloudConfirmLeaveBoard() {
  if (cloudPlusDraft) return true;
  if (boardDirty && cloudBoardId()) {
    return window.confirm("Leave without saving?");
  }
  return true;
}

function cloudAbandonUnsavedLeave() {
  cloudPlusDraft = false;
  if (typeof boardSaveTimer !== "undefined") {
    clearTimeout(boardSaveTimer);
    boardSaveTimer = null;
  }
  boardDirty = false;
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

function cloudSwitchToBoard(boardId) {
  var id = String(boardId || "");
  if (!id) return;
  if (cloudPlusDraft && cloudBoardId() === id) {
    if (!cloudConfirmLeaveBoard()) return;
    cloudAbandonUnsavedLeave();
    if (typeof loadCloudBoardByHash === "function") void loadCloudBoardByHash(location.hash);
    return;
  }
  if (!cloudPlusDraft && id === cloudBoardId()) return;
  if (!cloudConfirmLeaveBoard()) return;
  cloudAbandonUnsavedLeave();
  cloudSetBoardHash(id, false);
}

function cloudStartPlusDraft() {
  if (cloudPlusDraft) {
    renderCloudGroupTabs();
    return;
  }
  if (!cloudGroupId || !cloudSession || !cloudSession.user) return;
  if (typeof isShareGuest === "function" && isShareGuest()) return;
  if (!cloudConfirmLeaveBoard()) return;
  if (typeof boardSaveTimer !== "undefined") {
    clearTimeout(boardSaveTimer);
    boardSaveTimer = null;
  }
  cloudPlusDraft = true;
  if (boardSourceEl) {
    boardSourceEl.value = typeof blankHashBoardSource === "function"
      ? blankHashBoardSource("Untitled")
      : "board \"Untitled\"\n";
    delete boardSourceEl.dataset.boardSelectionKey;
    delete boardSourceEl.dataset.boardEdgeSelectionKey;
  }
  boardDirty = true;
  boardLocalRev = 1;
  boardServerRev = 0;
  if (typeof applyBoardLiveMeta === "function") {
    applyBoardLiveMeta({ id: "", title: "Untitled", version: 1 });
  }
  if (typeof rememberOwnerShareId === "function") rememberOwnerShareId("");
  if (typeof renderBoard === "function") renderBoard({ fit: false });
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
  renderCloudGroupTabs();
  setStatus("New board in this group");
}
