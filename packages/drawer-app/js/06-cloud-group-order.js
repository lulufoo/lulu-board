/* drawer-app/06-cloud-group-order.js — drag numbered group tabs to reorder, saved by rpc */
var cloudTabDragId = "";

function moveBoardId(ids, fromId, toId) {
  var from = ids.indexOf(fromId);
  var to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids.slice();
  var next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

async function cloudReorderGroupTabs(fromId, toId) {
  if (!cloudClient || !cloudGroupId) return false;
  var groupId = cloudGroupId;
  var before = cloudGroupMembers.slice();
  var ids = before.map(function (row) { return row.board_id; });
  var next = moveBoardId(ids, fromId, toId);
  if (next.join(",") === ids.join(",")) return false;
  var byId = {};
  before.forEach(function (row) { byId[row.board_id] = row; });
  cloudGroupMembers = next.map(function (id) { return byId[id]; });
  renderCloudGroupTabs();
  var result = await cloudClient.rpc("reorder_group_boards", {
    p_group_id: groupId,
    p_board_ids: next,
  });
  if (groupId !== cloudGroupId) return false;
  if (result.error) {
    cloudGroupMembers = before;
    renderCloudGroupTabs();
    setStatus(result.error.message || "Reorder failed", true);
    return false;
  }
  var saved = (result.data || []).map(function (row) { return byId[row.board_id]; }).filter(Boolean);
  if (saved.length === before.length) cloudGroupMembers = saved;
  renderCloudGroupTabs();
  setStatus("Reordered");
  return true;
}

function cloudTabFromEvent(event) {
  var tab = event.target && event.target.closest ? event.target.closest(".group-tab[data-board-id]") : null;
  return tab || null;
}

function cloudClearTabDragMarks(root) {
  root.querySelectorAll(".is-dragging, .is-drop").forEach(function (tab) {
    tab.classList.remove("is-dragging", "is-drop");
  });
}

(function wireCloudGroupOrder() {
  var root = document.getElementById("board-group-tabs");
  if (!root) return;
  root.addEventListener("dragstart", function (event) {
    var tab = cloudTabFromEvent(event);
    if (!tab) return;
    cloudTabDragId = tab.dataset.boardId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cloudTabDragId);
    tab.classList.add("is-dragging");
  });
  root.addEventListener("dragover", function (event) {
    var tab = cloudTabFromEvent(event);
    if (!cloudTabDragId || !tab) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    root.querySelectorAll(".is-drop").forEach(function (other) { other.classList.remove("is-drop"); });
    if (tab.dataset.boardId !== cloudTabDragId) tab.classList.add("is-drop");
  });
  root.addEventListener("drop", function (event) {
    var tab = cloudTabFromEvent(event);
    var fromId = cloudTabDragId;
    cloudTabDragId = "";
    cloudClearTabDragMarks(root);
    if (!tab || !fromId) return;
    event.preventDefault();
    void cloudReorderGroupTabs(fromId, tab.dataset.boardId);
  });
  root.addEventListener("dragend", function () {
    cloudTabDragId = "";
    cloudClearTabDragMarks(root);
  });
})();
