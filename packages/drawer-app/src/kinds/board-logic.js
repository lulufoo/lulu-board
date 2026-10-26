/* Boxes selection keys, geometry, and hit tests. No chrome writes. */
import BoxesRender, { View } from '../../../boxes/index.js';
import DrawerStyleLine from '../core/style-line.js';
import { scale } from '../state/shell-state.js';

export function boardNodeForSelection(board, selection) {
  if (!board || !selection) return null;
  if (typeof BoxesRender !== "undefined" && typeof BoxesRender.findNode === "function") {
    return BoxesRender.findNode(board, selection);
  }
  var found = null;
  var visit = function(box) {
    if (selection.kind === "box" && box.id === selection.id) found = box;
    if (selection.kind === "item" && box.id === selection.boxId) found = (box.items || [])[selection.index] || null;
    (box.boxes || []).forEach(visit);
  };
  (board.boxes || []).forEach(visit);
  return found;
}

export function boardLinkTargetForElement(el) {
  if (!el || !el.closest) return null;
  var item = el.closest(".board-item");
  if (item && item.classList.contains("board-root-item") && item.dataset.boardId) return item.dataset.boardId;
  if (item && item.dataset.boardBoxId != null && item.dataset.boardItemIndex != null) {
    if (item.dataset.boardId) return item.dataset.boardId;
    return { boxId: item.dataset.boardBoxId, index: Number(item.dataset.boardItemIndex) };
  }
  var zone = el.closest(".board-zone");
  if (zone && zone.dataset.boardId) return zone.dataset.boardId;
  return null;
}

export function boardLinkRefKey(ref) {
  if (ref && typeof ref === "object") return "item:" + ref.boxId + ":" + ref.index;
  return String(ref || "");
}

export function boardLinkSourceEl(root, ref) {
  if (!root) return null;
  if (ref && typeof ref === "object") return root.querySelector('[data-board-key="item:' + ref.boxId + ':' + ref.index + '"]');
  return root.querySelector('[data-board-id="' + ref + '"]');
}

export function normalizeBoardIdInput(raw) {
  return String(raw == null ? "" : raw).replace(/[^A-Za-z]/g, "").toUpperCase();
}

export function boardBoxScope(selection) {
  return selection && selection.scope === "tree" ? "tree" : "shell";
}

export function boardBoxKey(id, scope) {
  return scope === "tree" ? "tree:" + id : "box:" + id;
}

export function boardDomSelectionKey(key) {
  if (key && key.indexOf("tree:") === 0) return "box:" + key.slice(5);
  return key || "";
}

export function boardWantsTreeSelect(event) {
  return !!(event && (event.metaKey || event.ctrlKey));
}

export function boardTreeTargetEl(el) {
  if (!el) return null;
  if (el.classList.contains("board-item") && !el.classList.contains("board-root-item")) return el.closest(".board-zone");
  if (el.classList.contains("board-zone")) return el;
  return null;
}

export function boardSelectionFromBoxEl(el, scope) {
  var id = el && el.dataset ? el.dataset.boardId : "";
  var nextScope = scope === "tree" ? "tree" : "shell";
  return { kind: "box", key: boardBoxKey(id, nextScope), id: id, scope: nextScope };
}

export function boardSelectionWithId(selection, nextId) {
  var id = nextId ? String(nextId) : null;
  if (!selection) return selection;
  if (selection.kind === "box") return { kind: "box", key: boardBoxKey(id, boardBoxScope(selection)), id: id, scope: boardBoxScope(selection) };
  if (selection.kind !== "item") return selection;
  if (selection.boxId == null || selection.boxId === "") {
    return { kind: "item", key: id ? "item:" + id : selection.key, id: id, boxId: null, index: -1 };
  }
  return { kind: "item", key: selection.key, id: id, boxId: selection.boxId, index: selection.index };
}

export function boardItemSelectionFromKey(key) {
  var parts = String(key || "").split(":");
  if (parts[0] !== "item") return null;
  if (parts.length >= 3) return { kind: "item", key: key, boxId: parts[1], index: Number(parts[2]) };
  return { kind: "item", key: key, id: parts.slice(1).join(":"), boxId: null, index: -1 };
}

export function boardItemSelectionFromEl(el) {
  var boxId = el && el.dataset ? el.dataset.boardBoxId : "";
  var rootItem = !boxId || (el && el.classList && el.classList.contains("board-root-item"));
  return {
    kind: "item",
    key: el.dataset.boardKey,
    id: el.dataset.boardId || null,
    boxId: rootItem ? null : boxId,
    index: Number(el.dataset.boardItemIndex)
  };
}

export function selectionKeyFromEl(el) {
  if (!el) return "";
  if (el.classList.contains("board-edge") || el.classList.contains("board-edge-hit") || el.classList.contains("board-edge-visible") || el.classList.contains("board-edge-label") || el.classList.contains("board-slot")) {
    return el.dataset.boardEdgeKey || (el.dataset.boardEdgeIndex != null ? "link:" + el.dataset.boardEdgeIndex : "");
  }
  if (el.classList.contains("board-title-node") || el.classList.contains("board-html-header") || el.dataset.boardKind === "title" || (el.dataset.boardKey || "") === "title:board") {
    return "title:board";
  }
  if (el.classList.contains("board-item") || el.dataset.boardKind === "item" || String(el.dataset.boardKey || "").indexOf("item:") === 0) {
    var item = boardItemSelectionFromEl(el);
    return (item && item.key) || "";
  }
  return el.dataset.boardKey || (el.dataset.boardId ? "box:" + el.dataset.boardId : "");
}

// Top-level drag moves pins. Nested drag reorders kids in the parent box.
export function boardBoxIsTopLevel(board, id) {
  if (!id) return false;
  if (View && typeof View.topLevel === "function") {
    return View.topLevel(board).some(function(node) { return node.id === id; });
  }
  return ((board.views || board.boxes || [])).some(function(node) { return node.id === id; });
}

/* Pointer -> world point. The canvas is a zero-size anchor at the world origin,
 * so the live scale comes from the engine probe, not from the canvas box. */
export function boardCanvasPoint(canvas, event) {
  if (typeof BoxesRender !== "undefined" && typeof BoxesRender.worldPointFromClient === "function") {
    var p = BoxesRender.worldPointFromClient(canvas, event.clientX, event.clientY);
    return { x: p.x, y: p.y };
  }
  var rect = canvas.getBoundingClientRect(), s = (typeof scale === "number" && scale > 0) ? scale : 1;
  return { x: (event.clientX - rect.left) / s, y: (event.clientY - rect.top) / s };
}

export function boardParentContent(el) {
  if (!el) return null;
  if (el.parentElement && el.parentElement.classList.contains("box-content")) return el.parentElement;
  return el.closest ? el.closest(".box-content") : null;
}

export function boardReorderKids(content) {
  return Array.from((content && content.children) || []).filter(function(el) {
    return el.classList && (el.classList.contains("board-zone") || el.classList.contains("board-item"));
  });
}

export function boardPointInRect(el, event) {
  if (!el) return false;
  var r = el.getBoundingClientRect();
  return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
}

export function boardContentScale(el) {
  var r = el.getBoundingClientRect();
  return {
    x: r.width ? el.offsetWidth / r.width : 1,
    y: r.height ? el.offsetHeight / r.height : 1
  };
}

export function boardReorderInsertBefore(content, event) {
  var kids = boardReorderKids(content);
  var row = content.classList.contains("board-dir-row");
  var p = row ? event.clientX : event.clientY;
  for (var i = 0; i < kids.length; i += 1) {
    var r = kids[i].getBoundingClientRect();
    var mid = row ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
    if (p < mid) return i;
  }
  return kids.length;
}

export function boardEventIsItemMdLink(event) {
  var a = event.target && event.target.closest ? event.target.closest("a") : null;
  return !!(a && a.closest && a.closest(".board-item-md"));
}

export function isBoardCanvasKind() {
  if (typeof document === "undefined" || !document.documentElement) return false;
  var kind = document.documentElement.dataset.kind || "";
  if (DrawerStyleLine && typeof DrawerStyleLine.isMermaidKind === "function") {
    return !DrawerStyleLine.isMermaidKind(kind);
  }
  return kind !== "flowchart" && kind !== "mindmap" && kind !== "mermaid-unsupported";
}

export function boardCanvasHit(target) {
  return !!(target && target.closest && target.closest("#boardTitlePin, .board-title-node, .board-zone, .board-item, .board-edge, .board-edge-label, .board-slot.is-link"));
}

export const BOARD_EDGE_SELECTED_COLOR = "#db4c84";
