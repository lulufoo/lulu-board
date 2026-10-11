/* drawer-app/06-cloud-group-order.js — drag numbered group tabs to reorder, saved by rpc */
var cloudTabDragId = "";
var cloudTabDropAfter = false;
var cloudTabDropId = "";

function moveBoardId(ids, fromId, toId, after) {
  var from = ids.indexOf(fromId);
  var to = ids.indexOf(toId);
  if (from < 0 || to < 0) return ids.slice();
  var dest = to + (after ? 1 : 0);
  if (from < dest) dest -= 1;
  if (from === dest) return ids.slice();
  var next = ids.slice();
  next.splice(from, 1);
  next.splice(dest, 0, fromId);
  return next;
}

async function cloudReorderGroupTabs(fromId, toId, after) {
  if (!cloudClient || !cloudGroupId) return false;
  var groupId = cloudGroupId;
  var before = cloudGroupMembers.slice();
  var ids = before.map(function (row) { return row.board_id; });
  var next = moveBoardId(ids, fromId, toId, after);
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

function cloudDropLine(root) {
  var line = root.querySelector(".group-tab-drop-line");
  if (line) return line;
  line = document.createElement("div");
  line.className = "group-tab-drop-line";
  line.setAttribute("aria-hidden", "true");
  return line;
}

function cloudRemoveDropLine(root) {
  var line = root.querySelector(".group-tab-drop-line");
  if (line && line.parentNode) line.parentNode.removeChild(line);
}

function cloudClearTabDragMarks(root) {
  root.querySelectorAll(".is-dragging").forEach(function (tab) {
    tab.classList.remove("is-dragging");
  });
  cloudRemoveDropLine(root);
}

function cloudTabDropTarget(root, clientY) {
  var tabs = root.querySelectorAll(".group-tab[data-board-id]");
  var i;
  var box;
  for (i = 0; i < tabs.length; i += 1) {
    box = tabs[i].getBoundingClientRect();
    if (clientY < box.top) return { tab: tabs[i], after: false };
    if (clientY <= box.bottom) return { tab: tabs[i], after: clientY >= box.top + box.height / 2 };
  }
  if (!tabs.length) return null;
  return { tab: tabs[tabs.length - 1], after: true };
}

function cloudPlaceDropLine(root, tab, after) {
  var line = cloudDropLine(root);
  if (after) root.insertBefore(line, tab.nextSibling);
  else root.insertBefore(line, tab);
}

function cloudMarkTabDrop(root, event) {
  var target = cloudTabDropTarget(root, event.clientY);
  cloudTabDropId = "";
  if (!target || !cloudTabDragId) {
    cloudRemoveDropLine(root);
    return;
  }
  var ids = Array.prototype.map.call(root.querySelectorAll(".group-tab[data-board-id]"), function (tab) {
    return tab.dataset.boardId;
  });
  if (moveBoardId(ids, cloudTabDragId, target.tab.dataset.boardId, target.after).join(",") === ids.join(",")) {
    cloudRemoveDropLine(root);
    return;
  }
  cloudTabDropId = target.tab.dataset.boardId;
  cloudTabDropAfter = target.after;
  cloudPlaceDropLine(root, target.tab, target.after);
}

(function wireCloudGroupOrder() {
  var root = document.getElementById("board-group-tabs");
  if (!root) return;
  root.addEventListener("dragstart", function (event) {
    var tab = cloudTabFromEvent(event);
    if (!tab) return;
    cloudTabDragId = tab.dataset.boardId;
    cloudTabDropId = "";
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cloudTabDragId);
    tab.classList.add("is-dragging");
  });
  root.addEventListener("dragover", function (event) {
    if (!cloudTabDragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    cloudMarkTabDrop(root, event);
  });
  root.addEventListener("drop", function (event) {
    var fromId = cloudTabDragId;
    var toId = cloudTabDropId;
    var after = cloudTabDropAfter;
    cloudTabDragId = "";
    cloudTabDropId = "";
    cloudClearTabDragMarks(root);
    if (!fromId || !toId) return;
    event.preventDefault();
    void cloudReorderGroupTabs(fromId, toId, after);
  });
  root.addEventListener("dragend", function () {
    cloudTabDragId = "";
    cloudTabDropId = "";
    cloudClearTabDragMarks(root);
  });
})();
