/* drawer-app/02-board.js — lines 700-1719 of former inline module */
function boardNodeForSelection(board, selection) {
  if (!board || !selection) return null;
  if (typeof BoardRender !== "undefined" && typeof BoardRender.findNode === "function") {
    return BoardRender.findNode(board, selection);
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
function boardLinkTargetForElement(el) {
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
function boardLinkRefKey(ref) {
  if (ref && typeof ref === "object") return "item:" + ref.boxId + ":" + ref.index;
  return String(ref || "");
}
function boardLinkSourceEl(root, ref) {
  if (!root) return null;
  if (ref && typeof ref === "object") return root.querySelector('[data-board-key="item:' + ref.boxId + ':' + ref.index + '"]');
  return root.querySelector('[data-board-id="' + ref + '"]');
}
function boardLinkPickFromEvent(event, root, board) {
  if (!boardLinkMode) return false;
  var hit = event.target && event.target.closest ? event.target.closest(".board-item, .board-zone") : null;
  var endpoint = boardLinkTargetForElement(hit || event.target);
  if (!endpoint) {
    setBoardLinkMode(false);
    return true;
  }
  if (!boardLinkStart) {
    boardLinkStart = endpoint;
    document.querySelectorAll(".board-link-source").forEach(function(el) { el.classList.remove("board-link-source"); });
    var srcEl = boardLinkSourceEl(root, endpoint);
    if (srcEl) srcEl.classList.add("board-link-source");
    setStatus("Source " + boardLinkRefKey(endpoint) + " · click target");
    return true;
  }
  var from = boardLinkStart, to = endpoint;
  if (boardLinkRefKey(from) === boardLinkRefKey(to)) {
    setStatus("Target cannot match source", true);
    return true;
  }
  try {
    var result = BoardRender.addLink(boardSourceEl.value, from, to, boardLinkTitleValue(), boardLinkTypeValue(), boardLinkArrowValue());
    applyBoardEditResult(result);
    setBoardLinkMode(false);
    setStatus("Linked " + boardLinkRefKey(from) + " → " + boardLinkRefKey(to));
  } catch (err) {
    showBoardError(err instanceof Error ? err.message : String(err));
  }
  return true;
}
function setBoardLinkMode(active) {
  boardLinkMode = !!active; boardLinkStart = null;
  if (boardLinkButton) boardLinkButton.classList.toggle("is-active", boardLinkMode);
  document.documentElement.classList.toggle("board-link-mode", boardLinkMode);
  document.querySelectorAll(".board-link-source").forEach(function(el) { el.classList.remove("board-link-source"); });
  if (boardLinkMode) {
    selectedBoardEdge = null;
    delete boardSourceEl.dataset.boardEdgeSelectionKey;
    clearBoardSelection();
    closePropsPanel();
    showPropsForLinkMode();
    setStatus("Link mode · type and title, then click source / target box or item");
  } else {
    hidePropsLinkOnlyChrome();
    clearBoardSelection();
    if (document.documentElement.dataset.drawerMode === "board") setStatus("Board mode");
  }
}
function boardLinkTitleValue() {
  var value = boardTitleEditor ? String(boardTitleEditor.value || "").trim() : "";
  return value ? value.slice(0, 48) : "";
}
function boardLinkTypeValue() {
  return boardTypeEditor && String(boardTypeEditor.value || "").toLowerCase() === "dashed" ? "dashed" : "solid";
}
function boardLinkArrowValue() {
  return boardArrowEditor && String(boardArrowEditor.value || "").toLowerCase() === "both" ? "both" : "forward";
}
function setBoardArrowField(show, cur) {
  if (boardArrowField) boardArrowField.hidden = !show;
  if (boardArrowEditor) boardArrowEditor.hidden = !show;
  if (boardArrowLabel) boardArrowLabel.hidden = !show;
  if (boardArrowReverse) boardArrowReverse.hidden = !show;
  if (show) fillLinkArrowEditor(cur);
}
function fillLinkArrowEditor(cur) {
  if (!boardArrowEditor) return;
  var arrow = String(cur || "forward").toLowerCase();
  if (arrow !== "both") arrow = "forward";
  boardArrowEditor.innerHTML = "<option value=\"forward\">-&gt;</option><option value=\"both\">&lt;-&gt;</option>";
  boardArrowEditor.value = arrow;
  boardArrowEditor.hidden = false;
  boardArrowEditor.disabled = false;
  if (boardArrowLabel) { boardArrowLabel.hidden = false; boardArrowLabel.textContent = "Arrow"; }
  if (boardArrowField) boardArrowField.hidden = false;
  if (boardArrowReverse) {
    boardArrowReverse.hidden = false;
    boardArrowReverse.disabled = false;
  }
}
function fillLinkTypeEditor(cur) {
  if (!boardTypeEditor) return;
  var opts = ["solid", "dashed"];
  var type = String(cur || "solid");
  if (opts.indexOf(type) < 0) type = "solid";
  boardTypeEditor.innerHTML = opts.map(function(v){ return "<option value=\"" + v + "\">" + v + "</option>"; }).join("");
  boardTypeEditor.value = type;
  boardTypeEditor.hidden = false;
  boardTypeEditor.disabled = false;
  if (boardTypeLabel) { boardTypeLabel.hidden = false; boardTypeLabel.textContent = "Type"; }
}
function showPropsForLinkMode() {
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (propsKindLabel) propsKindLabel.textContent = "link";
  fillLinkTypeEditor("solid");
  setBoardArrowField(true, "forward");
  if (boardTitleEditor) { boardTitleEditor.hidden = false; boardTitleEditor.value = ""; }
  if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Title"; }
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirLabel) boardDirLabel.hidden = true;
  setBoardDirTip(false);
  setBoardAlignJustifyFields(false);
  setBoardIconField(false);
  setBoardIdField(false);
  setBoardShapeField(false);
  setBoardCapField(false);
  if (propsHint) propsHint.textContent = "Type, arrow, and optional title; then click source / target";
}
function showPropsForLinkEdge(title, type, arrow) {
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (propsKindLabel) propsKindLabel.textContent = "link";
  fillLinkTypeEditor(type);
  setBoardArrowField(true, arrow);
  if (boardTitleEditor) { boardTitleEditor.hidden = false; boardTitleEditor.value = String(title || ""); }
  if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Title"; }
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirLabel) boardDirLabel.hidden = true;
  setBoardDirTip(false);
  setBoardAlignJustifyFields(false);
  setBoardIconField(false);
  setBoardIdField(false);
  if (propsHint) propsHint.textContent = "Type, arrow, and title write back to DSL";
  setBoardShapeField(false);
  setBoardCapField(false);
}
function setBoardShapeField(show, shape) {
  var cur = shape === "diamond" ? "diamond" : "rect";
  if (boardShapeField) {
    boardShapeField.hidden = !show;
    Array.from(boardShapeField.querySelectorAll("[data-shape]")).forEach(function(btn) {
      btn.disabled = !show;
      btn.setAttribute("aria-pressed", btn.getAttribute("data-shape") === cur ? "true" : "false");
    });
  }
  if (boardShapeLabel) boardShapeLabel.hidden = !show;
}
function setBoardCapField(show, cap) {
  var authored = cap === "off";
  var cur = authored ? "off" : "on";
  if (boardCapField) boardCapField.hidden = !show;
  if (boardCapEditor) {
    boardCapEditor.hidden = !show;
    if (show) boardCapEditor.value = cur;
  }
  if (boardCapLabel) boardCapLabel.hidden = !show;
  setAuthoredTip(boardCapTip, show, authored);
}
function setAuthoredTip(el, show, authored) {
  if (!el) return;
  var unset = !!show && !authored;
  el.hidden = !unset;
  el.textContent = unset ? "default · not in source" : "";
}
function setBoardDirTip(show, authored) {
  setAuthoredTip(boardDirTip, show, authored);
}
function setBoardAlignJustifyFields(show, align, justify) {
  var authoredA = align === "start" || align === "center" || align === "stretch";
  var authoredJ = justify === "start" || justify === "center" || justify === "between" || justify === "stretch";
  var a = authoredA ? align : "stretch";
  var j = authoredJ ? justify : "start";
  if (boardAlignEditor) {
    boardAlignEditor.hidden = !show;
    if (show) boardAlignEditor.value = a;
  }
  if (boardAlignLabel) boardAlignLabel.hidden = !show;
  setAuthoredTip(boardAlignTip, show, authoredA);
  if (boardJustifyEditor) {
    boardJustifyEditor.hidden = !show;
    if (show) boardJustifyEditor.value = j;
  }
  if (boardJustifyLabel) boardJustifyLabel.hidden = !show;
  setAuthoredTip(boardJustifyTip, show, authoredJ);
}
function setBoardOrderField(show, info) {
  if (boardOrderField) boardOrderField.hidden = !show;
  if (boardOrderLabel) boardOrderLabel.hidden = !show;
  var row = !!(show && info && info.direction === "row");
  var atStart = !info || info.index <= 0;
  var atEnd = !info || info.index >= info.count - 1 || info.count < 2;
  if (boardOrderPrev) {
    boardOrderPrev.hidden = !show;
    boardOrderPrev.disabled = !show || atStart;
    boardOrderPrev.textContent = row ? "Left" : "Up";
    boardOrderPrev.title = row ? "Option+Left" : "Option+Up";
    boardOrderPrev.setAttribute("aria-label", row ? "Move left" : "Move up");
  }
  if (boardOrderNext) {
    boardOrderNext.hidden = !show;
    boardOrderNext.disabled = !show || atEnd;
    boardOrderNext.textContent = row ? "Right" : "Down";
    boardOrderNext.title = row ? "Option+Right" : "Option+Down";
    boardOrderNext.setAttribute("aria-label", row ? "Move right" : "Move down");
  }
}
function hidePropsLinkOnlyChrome() {
  if (boardTypeEditor) { boardTypeEditor.hidden = false; boardTypeEditor.disabled = false; }
  if (boardTypeLabel) boardTypeLabel.hidden = false;
  if (boardTitleEditor) boardTitleEditor.hidden = false;
  if (boardTitleLabel) boardTitleLabel.hidden = false;
  if (boardDirEditor) boardDirEditor.hidden = false;
  if (boardDirLabel) boardDirLabel.hidden = false;
  setBoardAlignJustifyFields(false);
  setBoardOrderField(false);
  setBoardArrowField(false);
  setBoardShapeField(false);
  setBoardCapField(false);
}
function fillBoardIconSec() {
  var Icons = window.BoardIcons;
  if (!boardIconSec || !Icons || !Icons.sections) return;
  boardIconSec.innerHTML = Icons.sections.map(function(sec) {
    var on = sec.id === boardIconSecId;
    return "<button type=\"button\" class=\"props-seg-btn\" data-sec=\"" + sec.id + "\" aria-pressed=\"" + (on ? "true" : "false") + "\">" + sec.label + "</button>";
  }).join("");
}
function fillBoardIconList() {
  var Icons = window.BoardIcons;
  if (!boardIconList || !Icons || !Icons.glyph || !Icons.sections) return;
  var spec = boardIconSecId ? Icons.sections.filter(function(sec) { return sec.id === boardIconSecId; })[0] : null;
  if (!spec) {
    var first = Icons.sections[0];
    if (first && first.id) {
      boardIconSecId = first.id;
      spec = first;
    } else {
      boardIconSecId = "";
      boardIconList.innerHTML = "";
      fillBoardIconSec();
      return;
    }
  }
  var html = "";
  (spec.icons || []).forEach(function(n) {
    var num = String(n).padStart(3, "0");
    var gloss = (Icons.gloss && Icons.gloss[n]) || "";
    html += "<button type=\"button\" class=\"props-icon-btn\" role=\"option\" data-icon=\"" + n + "\" title=\"" + num + (gloss ? " " + gloss : "") + "\">" +
      "<span class=\"props-icon-glyph\" aria-hidden=\"true\">" + (Icons.glyph(n) || "") + "</span>" +
      "<span class=\"props-icon-num\">" + num + "</span>" +
      (gloss ? "<span class=\"props-icon-gloss\">" + gloss + "</span>" : "") + "</button>";
  });
  boardIconList.innerHTML = html;
  fillBoardIconSec();
}
function markBoardIconPick(icon) {
  if (!boardIconList) return;
  Array.from(boardIconList.querySelectorAll(".props-icon-btn")).forEach(function(btn) {
    var on = Number(btn.dataset.icon) === Number(icon);
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  var selected = boardIconList.querySelector(".props-icon-btn.is-selected");
  if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: "nearest" });
}
function normalizeBoardIdInput(raw) {
  return String(raw == null ? "" : raw).replace(/[^A-Za-z]/g, "").toUpperCase();
}
function boardBoxScope(selection) {
  return selection && selection.scope === "tree" ? "tree" : "shell";
}
function boardBoxKey(id, scope) {
  return scope === "tree" ? "tree:" + id : "box:" + id;
}
function boardDomSelectionKey(key) {
  if (key && key.indexOf("tree:") === 0) return "box:" + key.slice(5);
  return key || "";
}
function boardWantsTreeSelect(event) {
  return !!(event && (event.metaKey || event.ctrlKey));
}
function boardTreeTargetEl(el) {
  if (!el) return null;
  if (el.classList.contains("board-item") && !el.classList.contains("board-root-item")) return el.closest(".board-zone");
  if (el.classList.contains("board-zone")) return el;
  return null;
}
function boardSelectionFromBoxEl(el, scope) {
  var id = el && el.dataset ? el.dataset.boardId : "";
  var nextScope = scope === "tree" ? "tree" : "shell";
  return { kind: "box", key: boardBoxKey(id, nextScope), id: id, scope: nextScope };
}
function boardSelectionWithId(selection, nextId) {
  var id = nextId ? String(nextId) : null;
  if (!selection) return selection;
  if (selection.kind === "box") return { kind: "box", key: boardBoxKey(id, boardBoxScope(selection)), id: id, scope: boardBoxScope(selection) };
  if (selection.kind !== "item") return selection;
  if (selection.boxId == null || selection.boxId === "") {
    return { kind: "item", key: id ? "item:" + id : selection.key, id: id, boxId: null, index: -1 };
  }
  return { kind: "item", key: selection.key, id: id, boxId: selection.boxId, index: selection.index };
}
function markBoardIdCopied(on) {
  if (!boardIdCopy) return;
  boardIdCopy.classList.toggle("is-copied", !!on);
  if (boardIdCopiedTimer) clearTimeout(boardIdCopiedTimer);
  boardIdCopiedTimer = 0;
  if (on) boardIdCopiedTimer = setTimeout(function() { markBoardIdCopied(false); }, 1200);
}
function syncBoardIdDup() {
  var draft = boardIdEditor ? normalizeBoardIdInput(boardIdEditor.value) : "";
  var taken = false;
  if (draft && selectedBoardNode && typeof BoardRender !== "undefined" && typeof BoardRender.isIdTaken === "function") {
    try { taken = !!BoardRender.isIdTaken(boardSourceEl.value, selectedBoardNode, draft); }
    catch (_) { taken = false; }
  }
  if (boardIdEditor) boardIdEditor.classList.toggle("is-dup", taken);
  if (boardIdDup) boardIdDup.hidden = !taken;
  return taken;
}
function setBoardIdField(show, id) {
  var value = show ? String(id == null ? "" : id).trim() : "";
  if (boardIdLabel) boardIdLabel.hidden = !show;
  if (boardIdField) boardIdField.hidden = !show;
  if (boardIdEditor) {
    boardIdEditor.value = value;
    boardIdEditor.classList.remove("is-dup");
  }
  if (boardIdDup) boardIdDup.hidden = true;
  if (boardIdCopy) {
    boardIdCopy.disabled = !value;
    boardIdCopy.setAttribute("aria-label", value ? "Copy node ID " + value : "Copy node ID");
  }
  markBoardIdCopied(false);
}
function filterBoardIdEditor() {
  if (!boardIdEditor) return "";
  var start = boardIdEditor.selectionStart;
  var raw = String(boardIdEditor.value || "");
  var next = normalizeBoardIdInput(raw);
  if (next !== raw) {
    var caret = normalizeBoardIdInput(raw.slice(0, start)).length;
    boardIdEditor.value = next;
    if (typeof boardIdEditor.setSelectionRange === "function") boardIdEditor.setSelectionRange(caret, caret);
  }
  if (boardIdCopy) {
    boardIdCopy.disabled = !next;
    boardIdCopy.setAttribute("aria-label", next ? "Copy node ID " + next : "Copy node ID");
  }
  markBoardIdCopied(false);
  syncBoardIdDup();
  return next;
}
function commitBoardId() {
  if (!boardIdEditor || !selectedBoardNode) return;
  if (selectedBoardNode.kind !== "box" && selectedBoardNode.kind !== "item") return;
  if (typeof BoardRender === "undefined" || typeof BoardRender.updateId !== "function") return;
  var current = String(selectedBoardNode.id || "").trim();
  var raw = String(boardIdEditor.value || "").trim();
  if (raw === current) return;
  var next = filterBoardIdEditor();
  if (next === current) return;
  if (syncBoardIdDup()) return;
  var keepSelection = boardSelectionWithId(selectedBoardNode, next);
  try {
    var source = BoardRender.updateId(boardSourceEl.value, selectedBoardNode, next);
    if (source !== boardSourceEl.value) {
      boardSourceEl.value = source;
      selectedBoardNode = keepSelection;
      boardSourceEl.dataset.boardSelectionKey = selectedBoardNode.key;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
    }
  } catch (err) {
    showBoardError(err instanceof Error ? err.message : String(err));
  }
}
function setBoardIconField(show, icon) {
  var Icons = window.BoardIcons;
  if (boardIconField) boardIconField.hidden = !show;
  if (!show || !boardIconList) return;
  var n = Number(icon);
  var ok = Number.isInteger(n) && n > 0 && Icons && Icons.glyph && Icons.glyph(n);
  boardIconPick = ok ? n : null;
  boardIconSecId = ok && Icons.sectionOf ? Icons.sectionOf(n) : "";
  fillBoardIconList();
  markBoardIconPick(boardIconPick);
}
function commitBoardIcon(nextIcon) {
  if (!selectedBoardNode || (selectedBoardNode.kind !== "item" && selectedBoardNode.kind !== "box") || typeof BoardRender.updateIcon !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateIcon(boardSourceEl.value, selectedBoardNode, nextIcon);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus(nextIcon == null ? "Icon cleared" : "Icon · " + nextIcon);
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}


function parseCssColor(raw) {
  var s = String(raw || "").trim();
  if (!s || s === "none" || s === "transparent") return null;
  var m = s.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 };
  m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  return null;
}
function formatCssColor(c) {
  if (!c) return "";
  if (c.a != null && c.a < 1) return "rgba(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ", " + c.a + ")";
  return "rgb(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ")";
}
/** Darken toward black; hue stays from live theme stroke. */
function darkenCssColor(raw, amount) {
  var c = parseCssColor(raw);
  if (!c) return raw;
  var f = 1 - (amount == null ? 0.4 : amount);
  return formatCssColor({ r: c.r * f, g: c.g * f, b: c.b * f, a: c.a });
}
function readBoardEdgePaint(el, attr) {
  if (!el) return "";
  var direct = (el.getAttribute && el.getAttribute(attr)) || "";
  if (direct && direct !== "none" && direct !== "currentColor" && direct !== "context-stroke") return direct;
  try {
    var cs = window.getComputedStyle(el);
    if (attr === "stroke" && cs && cs.stroke && cs.stroke !== "none") return cs.stroke;
    if (attr === "fill" && cs && cs.fill && cs.fill !== "none") return cs.fill;
  } catch (_e) {}
  return direct || "";
}
function restoreBoardEdgePaint(el) {
  if (!el) return;
  if (el.hasAttribute("data-board-sel-stroke")) {
    var prevStroke = el.getAttribute("data-board-sel-stroke");
    var prevWidth = el.getAttribute("data-board-sel-width");
    var prevStyleStroke = el.getAttribute("data-board-sel-style-stroke");
    var prevStyleWidth = el.getAttribute("data-board-sel-style-width");
    if (prevStroke === "") el.removeAttribute("stroke");
    else el.setAttribute("stroke", prevStroke);
    if (prevWidth === "") el.removeAttribute("stroke-width");
    else el.setAttribute("stroke-width", prevWidth);
    if (el.style) {
      if (prevStyleStroke === "") el.style.removeProperty("stroke");
      else el.style.stroke = prevStyleStroke;
      if (prevStyleWidth === "") el.style.removeProperty("stroke-width");
      else el.style.strokeWidth = prevStyleWidth;
    }
    el.removeAttribute("data-board-sel-stroke");
    el.removeAttribute("data-board-sel-width");
    el.removeAttribute("data-board-sel-style-stroke");
    el.removeAttribute("data-board-sel-style-width");
  }
  if (el.hasAttribute("data-board-sel-fill")) {
    var prevFill = el.getAttribute("data-board-sel-fill");
    var prevStyleFill = el.getAttribute("data-board-sel-style-fill");
    if (prevFill === "") el.removeAttribute("fill");
    else el.setAttribute("fill", prevFill);
    if (el.style) {
      if (prevStyleFill === "") el.style.removeProperty("fill");
      else el.style.fill = prevStyleFill;
    }
    el.removeAttribute("data-board-sel-fill");
    el.removeAttribute("data-board-sel-style-fill");
  }
  if (el.dataset.boardMarker) {
    el.setAttribute("marker-end", el.dataset.boardMarker);
    delete el.dataset.boardMarker;
  }
}
function restoreBoardEdgeMarker(el) {
  restoreBoardEdgePaint(el);
}
function applyBoardEdgeSelection(root) {
  document.querySelectorAll(".board-edge-selected").forEach(function(el) {
    el.classList.remove("board-edge-selected");
    restoreBoardEdgePaint(el);
  });
  if (!selectedBoardEdge && boardSourceEl.dataset.boardEdgeSelectionKey) {
    var index = Number(String(boardSourceEl.dataset.boardEdgeSelectionKey).split(":")[1]);
    if (Number.isInteger(index)) selectedBoardEdge = { kind: "link", key: "link:" + index, index: index };
  }
  if (!selectedBoardEdge || !root) return;
  Array.from(root.querySelectorAll("[data-board-edge-key]")).forEach(function(el) {
    if (el.dataset.boardEdgeKey !== selectedBoardEdge.key) return;
    if (el.classList.contains("board-slot")) return;
    el.classList.add("board-edge-selected");
    if (el.classList.contains("board-edge-visible")) {
      // Keep theme marker; context-stroke follows darkened path stroke (no black arrow swap).
      if (!el.hasAttribute("data-board-sel-stroke")) {
        el.setAttribute("data-board-sel-stroke", el.getAttribute("stroke") || "");
        el.setAttribute("data-board-sel-width", el.getAttribute("stroke-width") || "");
        el.setAttribute("data-board-sel-style-stroke", (el.style && el.style.stroke) || "");
        el.setAttribute("data-board-sel-style-width", (el.style && el.style.strokeWidth) || "");
      }
      var base = readBoardEdgePaint(el, "stroke") || "#2563eb";
      var accent = darkenCssColor(base, 0.4);
      el.setAttribute("stroke", accent);
      el.setAttribute("stroke-width", "2.6");
      if (el.style) {
        el.style.stroke = accent;
        el.style.strokeWidth = "2.6px";
      }
    }
    if (el.classList.contains("board-edge-label")) {
      if (!el.hasAttribute("data-board-sel-fill")) {
        el.setAttribute("data-board-sel-fill", el.getAttribute("fill") || "");
        el.setAttribute("data-board-sel-style-fill", (el.style && el.style.fill) || "");
      }
      var labelBase = readBoardEdgePaint(el, "fill") || readBoardEdgePaint(el, "stroke") || "#2563eb";
      var labelAccent = darkenCssColor(labelBase, 0.4);
      el.setAttribute("fill", labelAccent);
      if (el.style) el.style.fill = labelAccent;
    }
    if (el.parentNode) el.parentNode.appendChild(el);
  });
}
function selectBoardEdge(root, index) {
  var nextKey = "link:" + index;
  var alreadySelected = !!(selectedBoardEdge && selectedBoardEdge.key === nextKey);
  if (!alreadySelected && !boardLinkMode) closePropsPanel();
  selectedBoardNode = null; selectedBoardEdge = { kind: "link", key: nextKey, index: index };
  delete boardSourceEl.dataset.boardSelectionKey; boardSourceEl.dataset.boardEdgeSelectionKey = selectedBoardEdge.key;
  var title = "control";
  var type = "solid";
  var arrow = "forward";
  try {
    var board = BoardRender.parse(boardSourceEl.value);
    var link = (board.links || [])[index];
    if (link && (link.title || link.label)) title = link.title || link.label;
    if (link && link.type) type = link.type;
    if (link && link.arrow === "both") arrow = "both";
  } catch (_) {}
  showPropsForLinkEdge(title, type, arrow);
  applyBoardEdgeSelection(root); syncBoardEditControls();
}
function syncBoardEditControls() {
  var hasSelection = (!!selectedBoardNode && selectedBoardNode.kind !== "title") || !!selectedBoardEdge;
  // Item can add into a selected box OR as a top-level item (BoardRender.addItem) — keep enabled.
  if (boardAddItemButton) boardAddItemButton.disabled = false;
  if (boardDeleteButton) boardDeleteButton.disabled = !hasSelection;
}
function currentBoardSelectionKey() {
  if (selectedBoardEdge) return selectedBoardEdge.key;
  if (selectedBoardNode) return selectedBoardNode.key;
  return boardSourceEl.dataset.boardSelectionKey || boardSourceEl.dataset.boardEdgeSelectionKey || "";
}
function selectionKeyFromEl(el) {
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
function beginInspectGesture(key) {
  boardInspectGesture = { key: key || "", already: !!(key && key === currentBoardSelectionKey()), moved: false };
}
function markInspectGestureMoved() {
  if (boardInspectGesture) boardInspectGesture.moved = true;
}
function consumeInspectClick(key) {
  var gesture = boardInspectGesture;
  boardInspectGesture = null;
  return !!(gesture && !gesture.moved && gesture.already && gesture.key && gesture.key === key);
}
function inspectBoardSelection() {
  if (boardLinkMode) return;
  openPropsPanel();
}
function clearBoardSelection() {
  boardInspectGesture = null;
  selectedBoardNode = null;
  selectedBoardEdge = null;
  delete boardSourceEl.dataset.boardSelectionKey;
  delete boardSourceEl.dataset.boardEdgeSelectionKey;
  document.querySelectorAll(".board-selection, .board-selection-tree").forEach(function(el) { el.classList.remove("board-selection", "board-selection-tree"); });
  document.querySelectorAll(".board-edge-selected").forEach(function(el) {
    el.classList.remove("board-edge-selected");
    restoreBoardEdgeMarker(el);
  });
  if (!boardLinkMode) {
    hidePropsLinkOnlyChrome();
    if (boardInspector) boardInspector.hidden = true;
    closePropsPanel();
  }
  syncBoardEditControls();
}
function boardItemSelectionFromKey(key) {
  var parts = String(key || "").split(":");
  if (parts[0] !== "item") return null;
  if (parts.length >= 3) return { kind: "item", key: key, boxId: parts[1], index: Number(parts[2]) };
  return { kind: "item", key: key, id: parts.slice(1).join(":"), boxId: null, index: -1 };
}
function boardItemSelectionFromEl(el) {
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
function applyBoardSelection(root, board, restoreFromDataset) { applyBoardEdgeSelection(root); if (selectedBoardEdge) { if (boardInspector) boardInspector.hidden = true; syncBoardEditControls(); return; } document.querySelectorAll(".board-selection, .board-selection-tree").forEach(function(el) { el.classList.remove("board-selection", "board-selection-tree"); }); if (restoreFromDataset && !selectedBoardNode && boardSourceEl.dataset.boardSelectionKey) { var parts = boardSourceEl.dataset.boardSelectionKey.split(":"); selectedBoardNode = parts[0] === "title" ? { kind: "title", key: "title:board" } : parts[0] === "tree" ? { kind: "box", key: boardSourceEl.dataset.boardSelectionKey, id: parts.slice(1).join(":"), scope: "tree" } : parts[0] === "box" ? { kind: "box", key: boardSourceEl.dataset.boardSelectionKey, id: parts.slice(1).join(":"), scope: "shell" } : boardItemSelectionFromKey(boardSourceEl.dataset.boardSelectionKey); } if (!selectedBoardNode || !root) { if (boardInspector) boardInspector.hidden = true; syncBoardEditControls(); return; } var matchKey = selectedBoardNode.kind === "box" ? "box:" + selectedBoardNode.id : selectedBoardNode.key; var match = Array.from(root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === matchKey; });
  if (!match && selectedBoardNode.kind === "title") {
    match = (typeof boardPinnedTitleNode === "function" && boardPinnedTitleNode())
      || document.querySelector("#boardTitlePin [data-board-key=\"title:board\"]")
      || document.querySelector("#boardTitlePin .board-title-node, #boardTitlePin .board-html-header");
  }
  if (!match) { clearBoardSelection(); return; }
  match.classList.add("board-selection");
  if (selectedBoardNode.kind === "box" && selectedBoardNode.scope === "tree") {
    match.classList.add("board-selection-tree");
    match.querySelectorAll(".board-zone, .board-item").forEach(function(el) { el.classList.add("board-selection"); });
  }
  if (boardTitleEditor && selectedBoardNode) {
    var isTitle = selectedBoardNode.kind === "title";
    var isItem = selectedBoardNode.kind === "item";
    var node = isTitle ? { title: (board && board.title) || "", type: "board" } : boardNodeForSelection(board, selectedBoardNode);
    if (!node && !isTitle) { clearBoardSelection(); return; }
    boardInspector.hidden = false;
    hidePropsLinkOnlyChrome();
    if (propsEmpty) propsEmpty.hidden = true;
    if (propsFields) propsFields.hidden = false;
    if (propsKindLabel) propsKindLabel.textContent = isTitle ? "board" : (isItem ? "item" : (selectedBoardNode.scope === "tree" ? "box tree" : "box"));
    var itemType = isItem ? String((node && node.type) || "chip") : "";
    var isNote = itemType === "note";
    var isChipItem = itemType === "chip";
    var isTextItem = itemType === "text";
    var isMd = isNote || isChipItem || isTextItem;
    var isIcon = itemType === "icon";
    var isBoxIcon = !isTitle && !isItem;
    if (boardTitleLabel) boardTitleLabel.textContent = (isTitle || isItem) ? "Text" : "Title";
    boardTitleEditor.value = isItem ? (node.text || "") : (node.title || "");
    boardTitleEditor.rows = isMd ? 6 : 1;
    boardTitleEditor.classList.toggle("is-multiline", !!isMd);
    if (boardTypeEditor) {
      var opts = isTitle ? ["board"] : (isItem ? ["chip", "text", "note", "icon"] : ["card", "container", "layout"]);
      var cur = isTitle ? "board" : (isItem ? (node.type || "chip") : (node.type || node.kind || "card"));
      boardTypeEditor.innerHTML = opts.map(function(v){ return "<option value=\"" + v + "\">" + v + "</option>"; }).join("");
      boardTypeEditor.value = opts.indexOf(cur) >= 0 ? cur : opts[0];
      boardTypeEditor.disabled = !!isTitle;
      boardTypeEditor.hidden = false;
      if (boardTypeLabel) { boardTypeLabel.hidden = false; boardTypeLabel.textContent = "Type"; }
    }
    var protoId = "";
    if (!isTitle) protoId = (node && node.id) || (match && match.dataset && match.dataset.boardId) || selectedBoardNode.id || "";
    if (isTitle) setBoardIdField(false);
    else setBoardIdField(true, protoId);
    var boxType = (!isTitle && !isItem) ? String((node && (node.type || node.kind)) || "card").toLowerCase() : "";
    var isLayoutBox = boxType === "layout";
    if (isLayoutBox) {
      boardTitleEditor.value = "";
      boardTitleEditor.disabled = true;
      if (boardTitleLabel) boardTitleLabel.hidden = true;
      boardTitleEditor.hidden = true;
    } else {
      boardTitleEditor.disabled = false;
      boardTitleEditor.hidden = false;
      if (boardTitleLabel) boardTitleLabel.hidden = false;
    }
    setBoardShapeField(!!isChipItem, node && node.shape);
    setBoardCapField(!!isMd, node && node.cap);
    setBoardIconField((isIcon || isBoxIcon) && !isLayoutBox, ((isIcon || isBoxIcon) && !isLayoutBox) ? (node && node.icon) : null);
    if (boardDirEditor) {
      var showDir = !isItem;
      boardDirEditor.hidden = !showDir;
      if (boardDirLabel) boardDirLabel.hidden = !showDir;
      if (showDir) {
        var layout = (board && board.layout) || {};
        var authored = isTitle
          ? (layout.board && layout.board.direction)
          : (((layout.boxes || {})[selectedBoardNode.id] || {}).direction);
        var curDir = (authored === "row" || authored === "column")
          ? authored
          : (isTitle ? "row" : "column");
        boardDirEditor.value = curDir;
        setBoardDirTip(true, authored === "row" || authored === "column");
      } else {
        setBoardDirTip(false);
      }
    }
    if (!isTitle && !isItem) {
      var boxProps = (((board && board.layout && board.layout.boxes) || {})[selectedBoardNode.id] || {});
      setBoardAlignJustifyFields(true, boxProps.align, boxProps.justify);
    } else {
      setBoardAlignJustifyFields(false);
    }
    var orderInfo = null;
    if (!isTitle && typeof BoardRender !== "undefined" && typeof BoardRender.reorderInfo === "function") {
      try { orderInfo = BoardRender.reorderInfo(boardSourceEl.value, selectedBoardNode); } catch (_) { orderInfo = null; }
    }
    setBoardOrderField(!!orderInfo, orderInfo);
    if (propsHint) propsHint.textContent = isTitle
      ? "Board document · edit text; Direction = top-level box flow (default row)"
      : (isItem
        ? (isIcon
          ? "Icon · pick a category, then an icon number; Text is optional"
          : (isMd
          ? "Markdown · headings / lists / bold / italic / code; Enter = new line, ⌘/Ctrl+Enter saves"
          : (selectedBoardNode.boxId ? "Leaf inside a box · arrows select siblings · drag to reorder" : "Top-level item · Shape on chip; drag to place")))
        : (isLayoutBox
          ? "Layout · ⌘/Ctrl-click selects the tree; Delete removes the shell, or the tree when the tree is selected"
          : (boxType === "container"
            ? "Container · ⌘/Ctrl-click selects the tree; Delete removes the shell, or the tree when the tree is selected"
            : "Box · ⌘/Ctrl-click selects the tree; Delete removes the shell, or the tree when the tree is selected")));
  } syncBoardEditControls(); }
function selectBoardElement(el, root, board, event) {
  if (!el) return clearBoardSelection();
  var isTitle = el.classList.contains("board-title-node") || el.classList.contains("board-html-header") || el.dataset.boardKind === "title" || (el.dataset.boardKey || "") === "title:board";
  var isItem = !isTitle && (el.classList.contains("board-item") || el.dataset.boardKind === "item" || (el.dataset.boardKey || "").indexOf("item:") === 0);
  var next;
  if (isTitle) next = { kind: "title", key: "title:board" };
  else if (boardWantsTreeSelect(event)) {
    var treeEl = boardTreeTargetEl(el);
    next = (treeEl && treeEl.dataset.boardId) ? boardSelectionFromBoxEl(treeEl, "tree") : (isItem ? boardItemSelectionFromEl(el) : boardSelectionFromBoxEl(el, "shell"));
  } else {
    next = isItem ? boardItemSelectionFromEl(el) : boardSelectionFromBoxEl(el, "shell");
  }
  if (next.key !== currentBoardSelectionKey() && !boardLinkMode) closePropsPanel();
  selectedBoardEdge = null;
  selectedBoardNode = next;
  delete boardSourceEl.dataset.boardEdgeSelectionKey;
  boardSourceEl.dataset.boardSelectionKey = selectedBoardNode.key;
  applyBoardSelection(root, board);
}
function pickBoardElement(el, root, board, event) {
  beginInspectGesture(selectionKeyFromEl(el));
  selectBoardElement(el, root, board, event);
}
// Top-level drag moves pins. Nested drag reorders kids in the parent box.
function boardBoxIsTopLevel(board, id) {
  if (!id) return false;
  if (typeof BoardView !== "undefined" && BoardView.topLevel) {
    return BoardView.topLevel(board).some(function(node) { return node.id === id; });
  }
  return ((board.views || board.boxes || [])).some(function(node) { return node.id === id; });
}
function boardCanvasPoint(canvas, event) { var rect = canvas.getBoundingClientRect(), sx = canvas.clientWidth ? canvas.clientWidth / rect.width : 1, sy = canvas.clientHeight ? canvas.clientHeight / rect.height : 1; return { x: (event.clientX - rect.left) * sx, y: (event.clientY - rect.top) * sy }; }

function boardTitlePinEl() {
  return document.getElementById("boardTitlePin");
}
function clearDrawerBoot() {
  document.documentElement.removeAttribute('data-drawer-boot');
}
function pinBoardTitle() {
  var pin = boardTitlePinEl();
  if (pin) { pin.hidden = true; pin.innerHTML = ""; }
  if (document.documentElement.dataset.drawerMode !== "board") {
    if (document.title !== "Lulu Board") document.title = "Lulu Board";
    return;
  }
  var title = "";
  try {
    title = String((BoardRender.parse(boardSourceEl.value) || {}).title || "").trim();
  } catch (_) {}
  if (!title) {
    var heading = previewEl && previewEl.querySelector(".board-title-node h2, .board-html-header h2");
    title = heading ? String(heading.textContent || "").trim() : "";
  }
  var next = title || "Lulu Board";
  if (document.title !== next) document.title = next;
}
function boardPinnedTitleNode() {
  var pin = boardTitlePinEl();
  return (pin && pin.querySelector(".board-title-node, .board-html-header"))
    || (previewEl && previewEl.querySelector(".board-title-node, .board-html-header"))
    || null;
}
function boardTitleBottomLimit(canvas) {
  // Boxes must stay below the (pinned) board title with a stable margin.
  var margin = 20;
  if (!canvas) return margin;
  var title = typeof boardPinnedTitleNode === "function" ? boardPinnedTitleNode() : null;
  if (!title) {
    var root = canvas.closest(".board-render") || canvas.parentElement;
    title = root && root.querySelector(".board-title-node, .board-html-header");
  }
  if (!title) return margin;
  var cr = canvas.getBoundingClientRect();
  var tr = title.getBoundingClientRect();
  var sy = canvas.clientHeight && cr.height ? canvas.clientHeight / cr.height : 1;
  // Map the fixed title's bottom into canvas local coordinates (accounts for pan/zoom).
  var bottomInCanvas = (tr.bottom - cr.top) * sy;
  if (!Number.isFinite(bottomInCanvas)) return margin;
  return Math.max(margin, Math.ceil(bottomInCanvas + margin));
}
function clampBoardDragPosition(canvas, x, y) {
  // Unbounded like blank-canvas pan / grid — no title or origin floor.
  // (boardTitleBottomLimit kept for optional callers; drag must not fight the stage.)
  return { x: x, y: y };
}

function boardParentContent(el) {
  if (!el) return null;
  if (el.parentElement && el.parentElement.classList.contains("box-content")) return el.parentElement;
  return el.closest ? el.closest(".box-content") : null;
}
function boardReorderKids(content) {
  return Array.from((content && content.children) || []).filter(function(el) {
    return el.classList && (el.classList.contains("board-zone") || el.classList.contains("board-item"));
  });
}
function boardPointInRect(el, event) {
  if (!el) return false;
  var r = el.getBoundingClientRect();
  return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
}
function boardContentScale(el) {
  var r = el.getBoundingClientRect();
  return {
    x: r.width ? el.offsetWidth / r.width : 1,
    y: r.height ? el.offsetHeight / r.height : 1
  };
}
function boardReorderInsertBefore(content, event) {
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
function clearBoardReorderCaret(content) {
  if (!content) return;
  var caret = content.querySelector(":scope > .board-reorder-caret");
  if (caret) caret.remove();
}
function boardReorderGapRect(prevEl, nextEl, row, prev, next) {
  var node = prevEl && prevEl.nextElementSibling;
  while (node && node !== nextEl) {
    if (node.classList && node.classList.contains("board-slot")) return node.getBoundingClientRect();
    node = node.nextElementSibling;
  }
  if (row) {
    return {
      left: prev.right,
      right: next.left,
      top: Math.min(prev.top, next.top),
      bottom: Math.max(prev.bottom, next.bottom),
      width: next.left - prev.right,
      height: Math.max(prev.bottom, next.bottom) - Math.min(prev.top, next.top)
    };
  }
  return {
    left: Math.min(prev.left, next.left),
    right: Math.max(prev.right, next.right),
    top: prev.bottom,
    bottom: next.top,
    width: Math.max(prev.right, next.right) - Math.min(prev.left, next.left),
    height: next.top - prev.bottom
  };
}
function placeBoardReorderCaret(content, insertBefore) {
  var kids = boardReorderKids(content);
  if (!content || !kids.length) return;
  var caret = content.querySelector(":scope > .board-reorder-caret");
  if (!caret) {
    caret = document.createElement("span");
    caret.className = "board-reorder-caret";
    caret.setAttribute("aria-hidden", "true");
    content.appendChild(caret);
  }
  var row = content.classList.contains("board-dir-row");
  var origin = content.getBoundingClientRect();
  var scale = boardContentScale(content);
  var cs = getComputedStyle(content);
  var innerLeft = origin.left + (content.clientLeft + (parseFloat(cs.paddingLeft) || 0)) / scale.x;
  var innerTop = origin.top + (content.clientTop + (parseFloat(cs.paddingTop) || 0)) / scale.y;
  var innerRight = origin.right - ((parseFloat(cs.borderRightWidth) || 0) + (parseFloat(cs.paddingRight) || 0)) / scale.x;
  var innerBottom = origin.bottom - ((parseFloat(cs.borderBottomWidth) || 0) + (parseFloat(cs.paddingBottom) || 0)) / scale.y;
  var seam;
  var crossStart;
  var crossSize;
  if (insertBefore > 0 && insertBefore < kids.length) {
    var prevEl = kids[insertBefore - 1];
    var nextEl = kids[insertBefore];
    var prev = prevEl.getBoundingClientRect();
    var next = nextEl.getBoundingClientRect();
    var gap = boardReorderGapRect(prevEl, nextEl, row, prev, next);
    seam = row ? (gap.left + gap.right) / 2 : (gap.top + gap.bottom) / 2;
    crossStart = row ? gap.top : gap.left;
    crossSize = row ? gap.height : gap.width;
  } else if (insertBefore <= 0) {
    var first = kids[0].getBoundingClientRect();
    seam = row ? (innerLeft + first.left) / 2 : (innerTop + first.top) / 2;
    crossStart = row ? first.top : first.left;
    crossSize = row ? first.height : first.width;
  } else {
    var last = kids[kids.length - 1].getBoundingClientRect();
    seam = row ? (last.right + innerRight) / 2 : (last.bottom + innerBottom) / 2;
    crossStart = row ? last.top : last.left;
    crossSize = row ? last.height : last.width;
  }
  var bar = row ? Math.max(2, 2 * scale.x) : Math.max(2, 2 * scale.y);
  if (row) {
    caret.style.left = ((seam - origin.left) * scale.x - bar / 2) + "px";
    caret.style.top = ((crossStart - origin.top) * scale.y) + "px";
    caret.style.width = bar + "px";
    caret.style.height = Math.max(crossSize * scale.y, 16) + "px";
  } else {
    caret.style.left = ((crossStart - origin.left) * scale.x) + "px";
    caret.style.top = ((seam - origin.top) * scale.y - bar / 2) + "px";
    caret.style.width = Math.max(crossSize * scale.x, 16) + "px";
    caret.style.height = bar + "px";
  }
}
function startBoardReorderDrag(dragEl, event) {
  var content = boardParentContent(dragEl);
  if (!content) return null;
  return {
    hit: dragEl,
    content: content,
    parentZone: content.closest(".board-zone"),
    pointerId: event.pointerId,
    moved: false,
    mode: "reorder",
    insertBefore: null,
    startClientX: event.clientX,
    startClientY: event.clientY
  };
}
function wireBoardDrag(root, board) {
  var canvas = root && root.querySelector(".board-canvas"); if (!canvas || canvas.dataset.boardDragWired === "1") return; canvas.dataset.boardDragWired = "1"; var drag = null;
  canvas.addEventListener("pointerdown", function(event) {
    if (event.button !== 0) return;
    if (boardLinkMode) {
      boardLinkPickFromEvent(event, root, board);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var edgeHit = event.target.closest ? event.target.closest(".board-edge-hit, .board-edge-label, .board-slot.is-link") : null;
    if (edgeHit && canvas.contains(edgeHit)) {
      var edgeIndex = Number(edgeHit.dataset.boardEdgeIndex);
      if (Number.isInteger(edgeIndex)) {
        var edgeKey = edgeHit.dataset.boardEdgeKey || ("link:" + edgeIndex);
        beginInspectGesture(edgeKey);
        selectBoardEdge(root, edgeIndex);
        if (boardInspectGesture && boardInspectGesture.already) inspectBoardSelection();
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var itemHit = event.target.closest ? event.target.closest(".board-item") : null;
    var zoneHit = event.target.closest ? event.target.closest(".board-zone") : null;
    if (itemHit && !canvas.contains(itemHit)) itemHit = null;
    if (zoneHit && !canvas.contains(zoneHit)) zoneHit = null;
    var titleHit = event.target.closest ? event.target.closest(".board-title-node") : null;
    if (titleHit && canvas.contains(titleHit)) {
      pickBoardElement(titleHit, root, board, event);
      event.stopPropagation();
      return;
    }
    if (boardWantsTreeSelect(event)) {
      var treeHit = itemHit || zoneHit;
      if (treeHit) {
        pickBoardElement(treeHit, root, board, event);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    var nestedItem = itemHit && !itemHit.classList.contains("board-root-item");
    var nestedBox = zoneHit && !boardBoxIsTopLevel(board, zoneHit.dataset.boardId);
    if (nestedItem || (nestedBox && !itemHit)) {
      var reorderEl = nestedItem ? itemHit : zoneHit;
      pickBoardElement(reorderEl, root, board, event);
      drag = startBoardReorderDrag(reorderEl, event);
      if (!drag) { event.stopPropagation(); return; }
      reorderEl.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    var hit = (itemHit && itemHit.classList.contains("board-root-item")) ? itemHit : zoneHit;
    if (!hit) return;
    var zone = hit.classList.contains("board-zone") ? hit : hit.closest(".board-zone");
    var rootItem = hit.classList.contains("board-root-item");
    if (!rootItem && (!zone || !boardBoxIsTopLevel(board, zone.dataset.boardId))) {
      pickBoardElement(hit, root, board, event);
      event.stopPropagation();
      return;
    }
    pickBoardElement(hit, root, board, event);
    var dragEl = rootItem ? hit : zone;
    var point = boardCanvasPoint(canvas, event), x = Number.parseFloat(dragEl.style.left), y = Number.parseFloat(dragEl.style.top);
    drag = { hit: dragEl, pointerId: event.pointerId, start: point, x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, moved: false, mode: "position", dropTarget: null, startClientX: event.clientX, startClientY: event.clientY };
    dragEl.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
  });
  canvas.addEventListener("pointermove", function(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.mode === "reorder") {
      drag.moved = drag.moved || Math.abs(event.clientX - drag.startClientX) > 3 || Math.abs(event.clientY - drag.startClientY) > 3;
      if (drag.moved) markInspectGestureMoved();
      if (!drag.moved) { event.preventDefault(); return; }
      drag.hit.classList.add("board-reorder-dragging");
      if (drag.parentZone && boardPointInRect(drag.parentZone, event)) {
        drag.insertBefore = boardReorderInsertBefore(drag.content, event);
        placeBoardReorderCaret(drag.content, drag.insertBefore);
      } else {
        drag.insertBefore = null;
        clearBoardReorderCaret(drag.content);
      }
      event.preventDefault();
      return;
    }
    var point = boardCanvasPoint(canvas, event), rawX = Math.round(drag.x + point.x - drag.start.x), rawY = Math.round(drag.y + point.y - drag.start.y);
    var clamped = clampBoardDragPosition(canvas, rawX, rawY), x = clamped.x, y = clamped.y;
    drag.moved = drag.moved || Math.abs(x - drag.x) > 1 || Math.abs(y - drag.y) > 1;
    if (drag.moved) markInspectGestureMoved();
    drag.hit.style.left = x + "px"; drag.hit.style.top = y + "px"; event.preventDefault();
  });
  var finish = function(event, cancelled) {
    if (!drag || event.pointerId !== drag.pointerId) return; var done = drag; drag = null; try { done.hit.releasePointerCapture(event.pointerId); } catch (_) {}
    done.hit.classList.remove("board-reorder-dragging");
    if (done.content) clearBoardReorderCaret(done.content);
    if (cancelled || !done.moved) {
      if (!cancelled && boardInspectGesture && boardInspectGesture.already && !boardInspectGesture.moved) inspectBoardSelection();
      boardInspectGesture = null;
    }
    if (done.mode === "reorder") {
      if (cancelled || !done.moved || done.insertBefore == null) return;
      var fromIndex = boardReorderKids(done.content).indexOf(done.hit);
      var toIndex = BoardRender.reorderFinalIndex(fromIndex, done.insertBefore);
      if (fromIndex < 0 || toIndex === fromIndex) return;
      var reorderKeep = Object.assign({}, selectedBoardNode);
      try { var reordered = BoardRender.reorderNode(boardSourceEl.value, reorderKeep, toIndex); applyBoardEditResult(reordered); setStatus("Reordered · saved"); } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
      event.preventDefault(); event.stopPropagation(); return;
    }
    if (cancelled || !done.moved) return;
    var x = Number.parseFloat(done.hit.style.left), y = Number.parseFloat(done.hit.style.top);
    var clampedEnd = clampBoardDragPosition(canvas, x, y); x = clampedEnd.x; y = clampedEnd.y;
    done.hit.style.left = x + "px"; done.hit.style.top = y + "px";
    var keep = Object.assign({}, selectedBoardNode);
    try {
      boardSourceEl.value = BoardRender.updatePosition(boardSourceEl.value, keep, x, y);
      selectedBoardNode = keep;
      boardSourceEl.dataset.boardSelectionKey = keep.key || boardSourceEl.dataset.boardSelectionKey || "";
      updateBoardChars();
      scheduleBoardSave();
      // Avoid full remount flash: keep live DOM positions, only refresh edges.
      var liveRoot = previewEl.querySelector(".board-render");
      if (liveRoot && typeof BoardRender.refreshEdges === "function") {
        BoardRender.refreshEdges(liveRoot, BoardRender.parse(boardSourceEl.value));
        applyBoardSelection(liveRoot, BoardRender.parse(boardSourceEl.value));
        done.hit.classList.add("board-selection");
      }
      setStatus("Moved · saved layout");
    } catch (err) { done.hit.style.left = done.x + "px"; done.hit.style.top = done.y + "px"; showBoardError(err instanceof Error ? err.message : String(err)); }
    event.preventDefault(); event.stopPropagation();
  };
  canvas.addEventListener("pointerup", function(event) { finish(event, false); }); canvas.addEventListener("pointercancel", function(event) { finish(event, true); });
}
function wireBoardCanvas(root, board) { var canvas = root && root.querySelector(".board-canvas"); if (!canvas || canvas.dataset.boardClickWired === "1") return; canvas.dataset.boardClickWired = "1"; canvas.addEventListener("click", function(event) { var edge = event.target.closest ? event.target.closest(".board-edge, .board-edge-label, .board-slot.is-link") : null; var hit = event.target.closest ? event.target.closest(".board-title-node, .board-item, .board-zone") : null; if (boardLinkMode) { event.preventDefault(); event.stopPropagation(); return; } /* pick happens on pointerdown */
      if (edge) { var edgeKey = edge.dataset.boardEdgeKey || (edge.dataset.boardEdgeIndex != null ? "link:" + edge.dataset.boardEdgeIndex : ""); if (consumeInspectClick(edgeKey)) inspectBoardSelection(); event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); return; } }, true); canvas.addEventListener("click", function(event) { if (boardLinkMode) return; if (event.target.closest && event.target.closest(".board-edge, .board-edge-label, .board-slot.is-link")) return; var hit = event.target.closest(".board-title-node, .board-item, .board-zone"); if (!hit || !canvas.contains(hit)) { clearBoardSelection(); return; } var key = selectionKeyFromEl(hit); selectBoardElement(hit, root, board, event); if (consumeInspectClick(key)) inspectBoardSelection(); }); canvas.addEventListener("dblclick", function(event) { var hit = event.target.closest(".board-title-node, .board-item, .board-zone"); if (!hit || !canvas.contains(hit)) return; selectBoardElement(hit, root, board, event); inspectBoardSelection(); if (boardTitleEditor) { boardTitleEditor.focus(); boardTitleEditor.select(); } }); }

function commitBoardArrow() {
  if (!boardArrowEditor || !selectedBoardEdge || typeof BoardRender.updateLinkArrow !== "function") return;
  try {
    var nextLink = BoardRender.updateLinkArrow(boardSourceEl.value, selectedBoardEdge, boardArrowEditor.value);
    if (nextLink !== boardSourceEl.value) {
      boardSourceEl.value = nextLink;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Link arrow · " + (boardArrowEditor.value === "both" ? "<->" : "->"));
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardReverse() {
  if (!selectedBoardEdge || typeof BoardRender.reverseLink !== "function") return;
  try {
    var nextLink = BoardRender.reverseLink(boardSourceEl.value, selectedBoardEdge);
    if (nextLink !== boardSourceEl.value) {
      boardSourceEl.value = nextLink;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Link reversed");
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardShape(shape) {
  var nextShape = shape === "diamond" ? "diamond" : "rect";
  if (!selectedBoardNode || selectedBoardNode.kind !== "item") return;
  if (typeof BoardRender.updateShape !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateShape(boardSourceEl.value, selectedBoardNode, nextShape);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Shape · " + nextShape);
    }
    setBoardShapeField(true, nextShape);
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function persistBoardStyle(patch) {
  if (!boardSourceEl || !boardSourceEl.value.trim()) return;
  if (document.documentElement.dataset.drawerMode !== "board") return;
  if (typeof BoardRender === "undefined" || typeof BoardRender.updateStyle !== "function") return;
  try {
    var raw = boardSourceEl.value;
    var meta = null;
    var body = raw;
    try {
      var doc = splitDocument(raw);
      meta = doc.meta;
      body = doc.body;
    } catch (_e) {}
    var nextBody = BoardRender.updateStyle(body, patch || {});
    var next = meta ? joinDocument(meta, nextBody) : nextBody;
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      updateBoardChars();
      scheduleBoardSave();
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function syncBoardStyleChrome(board) {
  if (typeof BoardRender === "undefined" || typeof BoardRender.resolveStyle !== "function") return;
  var next = BoardRender.resolveStyle(board || {});
  if (typeof applyBoardItemCap === "function") applyBoardItemCap(next.item_cap, false, false);
  if (typeof applyBoardTypeStep === "function") applyBoardTypeStep(next.type_step, false, false);
  if (typeof syncBoardLinkRouteButton === "function") {
    if (typeof BoardRender.setLinkRouteStyle === "function") BoardRender.setLinkRouteStyle(next.link_route);
    syncBoardLinkRouteButton();
  }
  document.querySelectorAll("#diagramThemeMenu .theme-item").forEach(function(btn) {
    btn.classList.toggle("is-active", btn.dataset.theme === next.theme);
  });
}
function commitBoardCap() {
  if (!boardCapEditor || !selectedBoardNode || selectedBoardNode.kind !== "item") return;
  if (typeof BoardRender.updateCap !== "function") return;
  var nextCap = boardCapEditor.value === "off" ? "off" : "on";
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateCap(boardSourceEl.value, selectedBoardNode, nextCap);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Width Cap · " + nextCap);
    }
    setBoardCapField(true, nextCap);
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardType() {
  if (!boardTypeEditor) return;
  if (selectedBoardEdge && typeof BoardRender.updateLinkType === "function") {
    try {
      var nextLink = BoardRender.updateLinkType(boardSourceEl.value, selectedBoardEdge, boardTypeEditor.value);
      if (nextLink !== boardSourceEl.value) {
        boardSourceEl.value = nextLink;
        updateBoardChars();
        renderBoard();
        scheduleBoardSave();
        setStatus("Link type · " + boardTypeEditor.value);
      }
    } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
    return;
  }
  if (!selectedBoardNode || selectedBoardNode.kind === "title" || typeof BoardRender.updateType !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateType(boardSourceEl.value, selectedBoardNode, boardTypeEditor.value);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Type · " + boardTypeEditor.value);
      // Refresh props so layout hides title/icon immediately
      try {
        var b = typeof BoardRender !== "undefined" ? BoardRender.parse(boardSourceEl.value) : null;
        var root = previewEl && previewEl.querySelector(".board-render");
        if (b && root) applyBoardSelection(root, b);
      } catch (_e) {}
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardDir() {
  if (!selectedBoardNode || selectedBoardNode.kind === "item" || !boardDirEditor || typeof BoardRender.updateDir !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateDir(boardSourceEl.value, selectedBoardNode, boardDirEditor.value);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus("Direction · " + boardDirEditor.value);
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardBoxFlex(kind, editor, updateFn) {
  if (!selectedBoardNode || selectedBoardNode.kind !== "box" || !editor || typeof updateFn !== "function") return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = updateFn(boardSourceEl.value, selectedBoardNode, editor.value);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
      setStatus(kind + " · " + editor.value);
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function commitBoardAlign() {
  commitBoardBoxFlex("Align", boardAlignEditor, BoardRender.updateAlign);
}
function commitBoardJustify() {
  commitBoardBoxFlex("Justify", boardJustifyEditor, BoardRender.updateJustify);
}
function commitBoardTitle() {
  if (!boardTitleEditor) return;
  if (selectedBoardEdge && typeof BoardRender.updateLinkTitle === "function") {
    try {
      var nextLink = BoardRender.updateLinkTitle(boardSourceEl.value, selectedBoardEdge, boardLinkTitleValue());
      if (nextLink !== boardSourceEl.value) {
        boardSourceEl.value = nextLink;
        updateBoardChars();
        renderBoard();
        scheduleBoardSave();
        setStatus("Link title · saved");
      }
    } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
    return;
  }
  if (!selectedBoardNode) return;
  var keepSelection = Object.assign({}, selectedBoardNode);
  try {
    var next = BoardRender.updateTitle(boardSourceEl.value, selectedBoardNode, boardTitleEditor.value);
    if (next !== boardSourceEl.value) {
      boardSourceEl.value = next;
      selectedBoardNode = keepSelection;
      updateBoardChars();
      renderBoard();
      scheduleBoardSave();
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
function applyBoardEditResult(result) {
  boardSourceEl.value = result.source;
  selectedBoardNode = result.selection && result.selection.kind !== "link" ? result.selection : null; selectedBoardEdge = result.selection && result.selection.kind === "link" ? result.selection : null;
  if (selectedBoardNode) boardSourceEl.dataset.boardSelectionKey = selectedBoardNode.key;
  else delete boardSourceEl.dataset.boardSelectionKey; if (selectedBoardEdge) boardSourceEl.dataset.boardEdgeSelectionKey = selectedBoardEdge.key; else delete boardSourceEl.dataset.boardEdgeSelectionKey;
  updateBoardChars();
  renderBoard();
  scheduleBoardSave();
}
function boardEditAction(action) {
  try { applyBoardEditResult(action()); }
  catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}

function syncBoardLinkRouteButton() {
  if (typeof BoardRender.getLinkRouteStyle !== "function") return;
  var style = BoardRender.getLinkRouteStyle();
  var trunkBtn = $("#btnRouteTrunk");
  var staggerBtn = $("#btnRouteStagger");
  var straightBtn = $("#btnRouteStraight");
  if (trunkBtn) trunkBtn.setAttribute("aria-pressed", style === "trunk" ? "true" : "false");
  if (staggerBtn) staggerBtn.setAttribute("aria-pressed", style === "stagger" ? "true" : "false");
  if (straightBtn) straightBtn.setAttribute("aria-pressed", style === "straight" ? "true" : "false");
}
function applyBoardLinkRouteStyle(style, persist) {
  if (typeof BoardRender === "undefined" || typeof BoardRender.setLinkRouteStyle !== "function") {
    setStatus("Link route API missing — hard refresh (cache)");
    return;
  }
  BoardRender.setLinkRouteStyle(style);
  syncBoardLinkRouteButton();
  if (persist !== false) {
    try { localStorage.setItem("drawer.boardLinkRoute", BoardRender.getLinkRouteStyle()); } catch (_) {}
    persistBoardStyle({ link_route: BoardRender.getLinkRouteStyle() });
  }
  // Re-route without resetting zoom/pan.
  try {
    var root = previewEl && previewEl.querySelector(".board-render");
    if (root && boardSourceEl && boardSourceEl.value.trim()) {
      BoardRender.refreshEdges(root, BoardRender.parse(boardSourceEl.value));
      setStatus("Link route · " + BoardRender.getLinkRouteStyle());
    }
  } catch (err) { showBoardError(err instanceof Error ? err.message : String(err)); }
}
(function wireBoardLinkRouteSeg() {
  var trunkBtn = $("#btnRouteTrunk");
  var staggerBtn = $("#btnRouteStagger");
  var straightBtn = $("#btnRouteStraight");
  if (trunkBtn) trunkBtn.onclick = function() { applyBoardLinkRouteStyle("trunk"); };
  if (staggerBtn) staggerBtn.onclick = function() { applyBoardLinkRouteStyle("stagger"); };
  if (straightBtn) straightBtn.onclick = function() { applyBoardLinkRouteStyle("straight"); };
})();
(function initBoardLinkRoute() {
  var saved = "stagger";
  try { saved = localStorage.getItem("drawer.boardLinkRoute") || "stagger"; } catch (_) {}
  if (typeof BoardRender !== "undefined" && BoardRender.setLinkRouteStyle) {
    applyBoardLinkRouteStyle(saved, false);
  }
})();

if (boardAddBoxButton) boardAddBoxButton.onclick = function() { boardEditAction(function() { return BoardRender.addBox(boardSourceEl.value, selectedBoardNode && selectedBoardNode.kind === "box" ? selectedBoardNode : null); }); };
if (boardAddItemButton) boardAddItemButton.onclick = function() { boardEditAction(function() { return BoardRender.addItem(boardSourceEl.value, selectedBoardNode); }); };
if (boardDeleteButton) boardDeleteButton.onclick = function() { boardEditAction(function() { return selectedBoardEdge ? BoardRender.deleteLink(boardSourceEl.value, selectedBoardEdge) : BoardRender.deleteNode(boardSourceEl.value, selectedBoardNode); }); };
if (boardLinkButton) boardLinkButton.onclick = function() { setBoardLinkMode(!boardLinkMode); };
document.addEventListener("keydown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board" || (event.key !== "Delete" && event.key !== "Backspace") || (!selectedBoardNode && !selectedBoardEdge)) return;
  var target = event.target;
  if (target === boardSourceEl || target === boardTitleEditor || target === boardTypeEditor || (target && target.closest && target.closest("#boardIconField")) || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  event.preventDefault();
  boardEditAction(function() { return selectedBoardEdge ? BoardRender.deleteLink(boardSourceEl.value, selectedBoardEdge) : BoardRender.deleteNode(boardSourceEl.value, selectedBoardNode); });
});
function boardNudgeOrder(delta) {
  if (!selectedBoardNode || typeof BoardRender.reorderInfo !== "function") return;
  var info;
  try { info = BoardRender.reorderInfo(boardSourceEl.value, selectedBoardNode); } catch (_) { return; }
  if (!info || info.count < 2) return;
  var next = info.index + delta;
  if (next < 0 || next >= info.count) return;
  boardEditAction(function() { return BoardRender.reorderNode(boardSourceEl.value, selectedBoardNode, next); });
}
if (boardOrderPrev) boardOrderPrev.onclick = function() { boardNudgeOrder(-1); };
if (boardOrderNext) boardOrderNext.onclick = function() { boardNudgeOrder(1); };
function boardNudgeSelection(delta) {
  var root = previewEl && previewEl.querySelector(".board-render");
  if (!root || !selectedBoardNode || selectedBoardNode.kind === "title") return false;
  var el = root.querySelector("[data-board-key=\"" + selectedBoardNode.key + "\"]");
  var content = boardParentContent(el);
  if (!content) return false;
  var kids = boardReorderKids(content);
  var from = kids.indexOf(el);
  var next = from + delta;
  if (from < 0 || next < 0 || next >= kids.length) return false;
  selectBoardElement(kids[next], root, BoardRender.parse(boardSourceEl.value));
  return true;
}
var BOARD_NUDGE_STEPS = [1, 2, 4, 8, 16, 32];
var BOARD_NUDGE_HOLD = 2;
var boardNudgeSlide = { key: "", n: 0 };
function boardNudgeResetSlide() {
  boardNudgeSlide = { key: "", n: 0 };
}
function boardNudgeStepPx(key, isRepeat) {
  if (!isRepeat || boardNudgeSlide.key !== key) {
    boardNudgeSlide = { key: key, n: 0 };
    return BOARD_NUDGE_STEPS[0];
  }
  boardNudgeSlide.n += 1;
  var tier = Math.min(BOARD_NUDGE_STEPS.length - 1, Math.floor(boardNudgeSlide.n / BOARD_NUDGE_HOLD));
  return BOARD_NUDGE_STEPS[tier];
}
function boardWriteLivePosition(el, x, y) {
  var keep = Object.assign({}, selectedBoardNode);
  boardSourceEl.value = BoardRender.updatePosition(boardSourceEl.value, keep, x, y);
  selectedBoardNode = keep;
  boardSourceEl.dataset.boardSelectionKey = keep.key || boardSourceEl.dataset.boardSelectionKey || "";
  updateBoardChars();
  scheduleBoardSave();
  var liveRoot = previewEl.querySelector(".board-render");
  if (liveRoot && typeof BoardRender.refreshEdges === "function") {
    BoardRender.refreshEdges(liveRoot, BoardRender.parse(boardSourceEl.value));
    applyBoardSelection(liveRoot, BoardRender.parse(boardSourceEl.value));
    el.classList.add("board-selection");
  }
}
function boardNudgeTopLevel(dx, dy) {
  if (!selectedBoardNode || selectedBoardNode.kind === "title") return false;
  if (selectedBoardNode.kind === "item" && selectedBoardNode.boxId) return false;
  var root = previewEl && previewEl.querySelector(".board-render");
  if (!root) return false;
  var el = root.querySelector("[data-board-key=\"" + selectedBoardNode.key + "\"]");
  if (!el || boardParentContent(el)) return false;
  var canvas = previewEl.querySelector(".board-canvas");
  var x = Number.parseFloat(el.style.left);
  var y = Number.parseFloat(el.style.top);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  var next = clampBoardDragPosition(canvas, Math.round(x + dx), Math.round(y + dy));
  var prevX = x, prevY = y;
  el.style.left = next.x + "px";
  el.style.top = next.y + "px";
  try {
    boardWriteLivePosition(el, next.x, next.y);
    setStatus("Moved · saved layout");
  } catch (err) {
    el.style.left = prevX + "px";
    el.style.top = prevY + "px";
    showBoardError(err instanceof Error ? err.message : String(err));
  }
  return true;
}
document.addEventListener("keydown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board" || event.altKey || event.metaKey || event.ctrlKey) return;
  if (!selectedBoardNode || selectedBoardNode.kind === "title" || selectedBoardEdge) return;
  var delta = 0;
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") delta = -1;
  else if (event.key === "ArrowDown" || event.key === "ArrowRight") delta = 1;
  if (!delta) return;
  var target = event.target;
  if (target === boardSourceEl || target === boardTitleEditor || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  if (target && target.closest && target.closest("#boardIconField")) return;
  if (boardNudgeSelection(delta)) {
    event.preventDefault();
    return;
  }
  var step = boardNudgeStepPx(event.key, event.repeat);
  var dx = 0, dy = 0;
  if (event.key === "ArrowLeft") dx = -step;
  else if (event.key === "ArrowRight") dx = step;
  else if (event.key === "ArrowUp") dy = -step;
  else dy = step;
  if (!boardNudgeTopLevel(dx, dy)) return;
  event.preventDefault();
});
document.addEventListener("keyup", function(event) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  boardNudgeResetSlide();
});
window.addEventListener("blur", boardNudgeResetSlide);
document.addEventListener("keydown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board" || !event.altKey || event.metaKey || event.ctrlKey) return;
  if (!selectedBoardNode || selectedBoardNode.kind === "title") return;
  var target = event.target;
  if (target === boardSourceEl || target === boardTitleEditor || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  if (typeof BoardRender.reorderInfo !== "function") return;
  var info;
  try { info = BoardRender.reorderInfo(boardSourceEl.value, selectedBoardNode); } catch (_) { return; }
  if (!info || info.count < 2) return;
  var row = info.direction === "row";
  var delta = 0;
  if (row) {
    if (event.key === "ArrowLeft") delta = -1;
    else if (event.key === "ArrowRight") delta = 1;
  } else if (event.key === "ArrowUp") delta = -1;
  else if (event.key === "ArrowDown") delta = 1;
  if (!delta) return;
  event.preventDefault();
  boardNudgeOrder(delta);
});

function boardClickIsOnNode(event) {
  return !!(event.target.closest && event.target.closest(".board-title-node, .board-item, .board-zone, .board-edge, .board-edge-label, .board-slot.is-link, .board-inspector, .board-dock, .top-float, .menu, .sheet, button, input, select, textarea, label"));
}
// Blank click anywhere in the preview/canvas clears selection (grid, padding, svg empty).
previewEl.addEventListener("pointerdown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board") return;
  if (event.button !== 0) return;
  if (boardClickIsOnNode(event)) return;
  if (boardLinkMode) { setBoardLinkMode(false); return; }
  clearBoardSelection();
}, true);
previewEl.addEventListener("click", function(event) {
  if (document.documentElement.dataset.drawerMode !== "board") return;
  if (boardLinkMode) return;
  if (event.target.closest && event.target.closest(".board-edge, .board-edge-label, .board-slot.is-link")) return;
  var canvas = event.target.closest(".board-canvas");
  var root = event.target.closest(".board-render");
  var hit = event.target.closest(".board-title-node, .board-item, .board-zone");
  if (hit && canvas && canvas.contains(hit)) return;
  if (!boardClickIsOnNode(event)) clearBoardSelection();
});
previewEl.addEventListener("dblclick", function(event) {
  var canvas = event.target.closest(".board-canvas"); if (!canvas) return;
  var root = canvas.closest(".board-render");
  var hit = event.target.closest(".board-title-node, .board-item, .board-zone");
  if (!hit || !canvas.contains(hit)) return;
  selectBoardElement(hit, root, BoardRender.parse(boardSourceEl.value));
  inspectBoardSelection();
  if (boardTitleEditor) { boardTitleEditor.focus(); boardTitleEditor.select(); }
});
function renderBoard(opts) {
  opts = opts || {};
  syncBoardEditControls();
  previewEl.classList.add('board-preview');
  const text = boardSourceEl.value.trim(); updateBoardChars();
  if (!text) { previewEl.innerHTML = ''; if (typeof pinBoardTitle === "function") pinBoardTitle(); showBoardError(''); setStatus('No Board source'); clearDrawerBoot(); return; }
  BoardRender.render(text, previewEl).then((rendered) => {
    try {
      syncBoardLinkRouteButton(); wireBoardCanvas(rendered.root, rendered.board); wireBoardDrag(rendered.root, rendered.board); applyBoardSelection(rendered.root, rendered.board, true); var retained = Array.from(rendered.root.querySelectorAll("[data-board-key]")).find(function(el) { return el.dataset.boardKey === boardDomSelectionKey(boardSourceEl.dataset.boardSelectionKey); }); if (retained) retained.classList.add("board-selection");
      // Repaint the live root after any mode/bootstrap render race.
      if (rendered && rendered.root && rendered.root.isConnected && rendered.frames) rendered.frames.forEach((frame, id) => { const el = rendered.root.querySelector("[data-board-id=\"" + id + "\"]"); if (!el || el.dataset.boardNested === "1") return; el.style.left = frame.x + "px"; el.style.top = frame.y + "px"; el.style.width = frame.w + "px"; var grow = el.dataset.boardType === "note" || el.dataset.boardType === "layout" || el.dataset.boardType === "container"; if (grow) { el.style.minHeight = frame.h + "px"; el.style.height = "auto"; } else { el.style.minHeight = ""; el.style.height = frame.h + "px"; } });
      showBoardError(''); setStatus(`Board rendered · ${new Date().toLocaleTimeString()}`);
      syncBoardStyleChrome(rendered.board);
      applyBoardThemeToPreview();
      if (opts.fit) {
        fitBoardView({ persist: true });
      } else if (opts.restoreView) {
        applyRestoredBoardView();
      } else {
        applyTransform();
      }
    } finally {
      pinBoardTitle();
      // Two frames: let pin/title + item frame rects settle while stage still opacity:0.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { clearDrawerBoot(); });
      });
    }
  }).catch((err) => {
    pinBoardTitle();
    clearDrawerBoot();
    showBoardError(err instanceof Error ? err.message : String(err)); setStatus('Invalid Board source', true);
  });
}
function scheduleBoardRender() { clearTimeout(boardRenderTimer); boardRenderTimer = setTimeout(renderBoard, 220); }
function setBoardSyncUI(state = 'ok') { const pill = $('#boardSyncPill'); if (!pill) return; const label = state === 'saving' ? 'saving' : state === 'error' ? 'error' : state === 'conflict' ? 'conflict' : 'rev'; pill.className = 'pill ' + (state === 'ok' ? 'ok' : 'warn'); pill.innerHTML = `${label} <b>${boardLocalRev}</b>`; }
function scheduleBoardSave() { boardDirty = true; clearTimeout(boardSaveTimer); setBoardSyncUI('saving'); boardSaveTimer = setTimeout(() => void saveBoardToFile(), 350); }
function flushBoardSave() {
  if (!boardDirty && !boardSaveTimer) return Promise.resolve();
  clearTimeout(boardSaveTimer);
  boardSaveTimer = null;
  return saveBoardToFile();
}
window.addEventListener("pagehide", function() { void flushBoardSave(); });
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "hidden") void flushBoardSave();
});
async function saveBoardToHash() {
  boardSaveTimer = null;
  const text = boardSourceEl.value;
  const seq = ++boardSaveSeq;
  try {
    const token = await encodeBoardHash(text);
    if (seq !== boardSaveSeq) return;
    const next = "#" + token;
    if (location.hash !== next) {
      history.replaceState(null, "", location.pathname + location.search + next);
    }
    boardDirty = false;
    boardLocalRev = (Number(boardLocalRev) || 0) + 1;
    setBoardSyncUI("ok");
    setStatus("Saved in URL");
  } catch (err) {
    setBoardSyncUI("error");
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
}
async function saveBoardToFile() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    return saveBoardToHash();
  }
  boardSaveTimer = null;
  const text = boardSourceEl.value, seq = ++boardSaveSeq, baseRev = boardLocalRev;
  try {
    const headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Board-Rev': String(baseRev),
      'X-Board-Via': 'ui',
      'X-Board-Label': 'docker-sbx-board',
    };
    if (typeof liveBoardId !== 'undefined' && liveBoardId) headers['X-Board-Id'] = liveBoardId;
    if (typeof liveBoardTitle !== 'undefined' && liveBoardTitle) headers['X-Board-Title'] = headerByteString(liveBoardTitle);
    const res = await fetch('./board.bmd', { method: 'PUT', headers, body: text });
    if (seq !== boardSaveSeq) return;
    if (res.status === 409) { const payload = await res.json(); boardLocalRev = Number(payload.version != null ? payload.version : payload.rev) || boardLocalRev; boardDirty = false; if (typeof payload.source === 'string') { boardSourceEl.value = payload.source; renderBoard(); } setBoardSyncUI('conflict'); setStatus(`Board version conflict → loaded v ${boardLocalRev}`, true); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    boardLocalRev = Number(res.headers.get('X-Board-Rev')) || baseRev + 1; boardDirty = false; setBoardSyncUI('ok');
    try { var saved = splitDocument(text); boardSourceEl.value = joinDocument({ id: saved.meta.id, version: boardLocalRev }, saved.body); } catch (_e) {}
    setStatus(`Board saved v ${boardLocalRev}`);
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok && typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(await metaRes.json());
    } catch (_e) {}
  } catch (err) { setBoardSyncUI('error'); setStatus(err instanceof Error ? err.message : String(err), true); }
}
async function loadBoardPolled() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") return;
  if (boardDirty || boardSaveTimer) return;
  try {
    const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' }); if (!metaRes.ok) return;
    const meta = await metaRes.json(), remoteRev = Number(meta.version != null ? meta.version : meta.rev) || 0;
    if (typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(meta);
    if (remoteRev <= boardLocalRev) { setBoardSyncUI('ok'); return; }
    const res = await fetch(`./board.bmd?ts=${Date.now()}`, { cache: 'no-store' }); if (!res.ok) return;
    const text = await res.text(); boardLocalRev = Number(res.headers.get('X-Board-Rev')) || remoteRev; boardDirty = false;
    if (boardSourceEl.value !== text) { boardSourceEl.value = text; renderBoard({ fit: false }); setStatus(`Board loaded r${boardLocalRev}`); }
    setBoardSyncUI('ok');
  } catch (_) {}
}
async function bootstrapBoardFromHash() {
  var raw = String(location.hash || "").replace(/^#/, "");
  if (!raw) {
    var blank = typeof blankHashBoardSource === "function"
      ? blankHashBoardSource("Untitled")
      : "board \"Untitled\"\n";
    boardSourceEl.value = blank;
    boardLocalRev = 0;
    try {
      var seeded = splitDocument(blank);
      if (typeof applyBoardLiveMeta === "function") {
        applyBoardLiveMeta({ id: seeded.meta.id, version: seeded.meta.version, title: "Untitled" });
      }
    } catch (_e) {}
    await saveBoardToHash();
    setStatus("New board");
    return;
  }
  try {
    boardSourceEl.value = await decodeBoardHash(raw);
    boardLocalRev = 1;
  } catch (err) {
    boardSourceEl.value = "";
    if (typeof showBoardError === "function") {
      showBoardError(err instanceof Error ? err.message : String(err));
    }
    setStatus("Could not read board from URL", true);
  }
}
async function bootstrapBoard() {
  if (typeof boardPersistMode === "function" && boardPersistMode() === "hash") {
    await bootstrapBoardFromHash();
  } else {
    try { const res = await fetch('./board.bmd', { cache: 'no-store' }); if (res.ok) { boardSourceEl.value = await res.text(); boardLocalRev = Number(res.headers.get('X-Board-Rev')) || 0; } else boardSourceEl.value = ''; }
    catch (_) { boardSourceEl.value = ''; }
    try {
      const metaRes = await fetch(`./board.meta.json?ts=${Date.now()}`, { cache: 'no-store' });
      if (metaRes.ok && typeof applyBoardLiveMeta === 'function') applyBoardLiveMeta(await metaRes.json());
    } catch (_e) {}
  }
  boardDirty = false; updateBoardChars(); setBoardSyncUI('ok');
  if (boardSourceEl.value.trim()) {
    await new Promise(function (resolve) {
      var done = false;
      var finish = function () { if (done) return; done = true; resolve(); };
      try {
        renderBoard({ fit: false, restoreView: true });
        // renderBoard is async via promise; wait for board-render or timeout
        var turns = 0;
        (function wait() {
          if (previewEl && previewEl.querySelector(".board-render")) return finish();
          if (++turns > 120) return finish();
          requestAnimationFrame(wait);
        })();
      } catch (_e) { finish(); }
    });
  }
}

