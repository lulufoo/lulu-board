/* Cloud layer. Chrome leftover is reached through hooks. */
import {
  cloudSession,
  cloudGroupId,
  cloudGroupMembers,
  cloudTabDragId,
  cloudTabDropAfter,
  cloudTabDropId,
  setCloudGroupMembers,
  setCloudTabDragId,
  setCloudTabDropAfter,
  setCloudTabDropId,
} from './cloud-state.js';
import { setStatus } from '../state/shell-state.js';

import { renderCloudGroupTabs } from './cloud-group-tabs.js';

/* drawer-app/06-cloud-group-order.js — drag numbered group tabs to reorder, saved by the board API */

function moveDiagramId(ids, fromId, toId, after) {
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
  var accessToken = cloudSession && cloudSession.access_token;
  if (!accessToken || !cloudGroupId) return false;
  var groupId = cloudGroupId;
  var before = cloudGroupMembers.slice();
  var ids = before.map(function (row) { return row.graph_id; });
  var next = moveDiagramId(ids, fromId, toId, after);
  if (next.join(",") === ids.join(",")) return false;
  var byId = {};
  before.forEach(function (row) { byId[row.graph_id] = row; });
  setCloudGroupMembers(next.map(function (id) { return byId[id]; }));
  renderCloudGroupTabs();
  var response = await fetch("https://api.luluboard.app/groups/reorder", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ group_id: groupId, diagram_ids: next }),
  });
  var text = await response.text();
  var body = text ? JSON.parse(text) : null;
  if (groupId !== cloudGroupId) return false;
  if (!response.ok) {
    setCloudGroupMembers(before);
    renderCloudGroupTabs();
    setStatus((body && (body.message || body.error)) || "Reorder failed", true);
    return false;
  }
  var saved = (Array.isArray(body) ? body : []).map(function (row) { return byId[row.graph_id]; }).filter(Boolean);
  if (saved.length === before.length) setCloudGroupMembers(saved);
  renderCloudGroupTabs();
  setStatus("Reordered");
  return true;
}

function cloudTabFromEvent(event) {
  var tab = event.target && event.target.closest ? event.target.closest(".group-tab[data-diagram-id]") : null;
  return tab || null;
}

function cloudClearDropOn(root) {
  root.querySelectorAll(".group-tab-drop-line.is-on").forEach(function (line) {
    line.classList.remove("is-on");
  });
}

function cloudClearTabDragMarks(root) {
  root.querySelectorAll(".is-dragging").forEach(function (tab) {
    tab.classList.remove("is-dragging");
  });
  cloudClearDropOn(root);
}

function cloudTabDropTarget(root, clientY) {
  var tabs = root.querySelectorAll(".group-tab[data-diagram-id]");
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

function cloudSlotLine(tab, after) {
  var line = after ? tab.nextElementSibling : tab.previousElementSibling;
  if (line && line.classList && line.classList.contains("group-tab-drop-line")) return line;
  return null;
}

function cloudMarkTabDrop(root, event) {
  var target = cloudTabDropTarget(root, event.clientY);
  setCloudTabDropId("");
  cloudClearDropOn(root);
  if (!target || !cloudTabDragId) return;
  var ids = Array.prototype.map.call(root.querySelectorAll(".group-tab[data-diagram-id]"), function (tab) {
    return tab.dataset.diagramId;
  });
  if (moveDiagramId(ids, cloudTabDragId, target.tab.dataset.diagramId, target.after).join(",") === ids.join(",")) return;
  var line = cloudSlotLine(target.tab, target.after);
  if (!line) return;
  setCloudTabDropId(target.tab.dataset.diagramId);
  setCloudTabDropAfter(target.after);
  line.classList.add("is-on");
}

(function wireCloudGroupOrder() {
  var root = document.getElementById("diagram-group-tabs");
  if (!root) return;
  root.addEventListener("dragstart", function (event) {
    var tab = cloudTabFromEvent(event);
    if (!tab) return;
    setCloudTabDragId(tab.dataset.diagramId);
    setCloudTabDropId("");
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
    setCloudTabDragId("");
    setCloudTabDropId("");
    cloudClearTabDragMarks(root);
    if (!fromId || !toId) return;
    event.preventDefault();
    void cloudReorderGroupTabs(fromId, toId, after);
  });
  root.addEventListener("dragend", function () {
    setCloudTabDragId("");
    setCloudTabDropId("");
    cloudClearTabDragMarks(root);
  });
})();

