/* drawer-app/03-mermaid.js — lines 1720-2296 of former inline module */
function currentMermaidSelectionKey() {
  return MermaidInspect.getSelectionKey();
}
function beginMermaidInspectGesture(key) {
  return MermaidInspect.begin(key);
}
function consumeMermaidInspectClick(key) {
  return MermaidInspect.consumeClick(key);
}
function inspectMermaidSelection() {
  if (mermaidLinkMode) return;
  MermaidInspect.inspect({
    blocked: false,
    fill: function() {
      if (selectedMermaid && selectedMermaid.kind === "topic") fillMindmapProps();
      else if (typeof isStateMode === "function" && isStateMode() && typeof fillStateProps === "function") fillStateProps();
      else fillMermaidProps();
    },
  });
}

function showMermaidError(message) {
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.classList.add("show");
  }
  setStatus(message, true);
}

function syncMermaidDeleteButton() {
  if (!mermaidDeleteButton) return;
  var on = document.documentElement.dataset.drawerMode === "mermaid" && document.documentElement.dataset.mermaidFlowchart === "1" && !!selectedMermaid;
  mermaidDeleteButton.disabled = !on;
}


function installMermaidEdgeHits(root) {
  if (!root) return;
  root.querySelectorAll("path.mermaid-edge-hit").forEach(function(el) { el.remove(); });
  function addHit(path) {
    if (!path) return;
    var hit = path.cloneNode(false);
    hit.removeAttribute("id");
    hit.removeAttribute("marker-end");
    hit.removeAttribute("marker-start");
    hit.removeAttribute("style");
    hit.setAttribute("class", "mermaid-edge-hit");
    if (path.id) hit.setAttribute("data-edge-dom-id", path.id);
    hit.setAttribute("fill", "none");
    hit.setAttribute("stroke", "transparent");
    hit.setAttribute("stroke-width", "14");
    hit.setAttribute("pointer-events", "stroke");
    if (path.parentNode) path.parentNode.insertBefore(hit, path);
  }
  root.querySelectorAll("path.flowchart-link").forEach(function(path) {
    if (!path.id) return;
    addHit(path);
  });
  // State diagram transitions (incl. short [*] edges) — index-aligned with path.transition.
  root.querySelectorAll("path.transition").forEach(function(path) {
    addHit(path);
  });
}

/* Color helpers live in 02-board.js (loaded first); keep defs only if absent. */
if (typeof parseCssColor !== "function") {
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
}
if (typeof formatCssColor !== "function") {
function formatCssColor(c) {
  if (!c) return "";
  if (c.a != null && c.a < 1) return "rgba(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ", " + c.a + ")";
  return "rgb(" + Math.round(c.r) + ", " + Math.round(c.g) + ", " + Math.round(c.b) + ")";
}
}
if (typeof darkenCssColor !== "function") {
/** Darken toward black (Board-like emphasis); hue stays from live theme stroke. */
function darkenCssColor(raw, amount) {
  var c = parseCssColor(raw);
  if (!c) return raw;
  var f = 1 - (amount == null ? 0.4 : amount);
  return formatCssColor({ r: c.r * f, g: c.g * f, b: c.b * f, a: c.a });
}
}
function readMermaidEdgeStroke(el) {
  if (!el) return "#333333";
  var direct = (el.getAttribute && el.getAttribute("stroke")) || "";
  if (direct && direct !== "none" && direct !== "currentColor") return direct;
  try {
    var cs = window.getComputedStyle(el);
    if (cs && cs.stroke && cs.stroke !== "none") return cs.stroke;
  } catch (_e) {}
  try {
    var svg = el.ownerSVGElement || (previewEl && previewEl.querySelector("svg"));
    if (svg) {
      var gcs = window.getComputedStyle(svg);
      if (gcs && gcs.color) return gcs.color;
    }
  } catch (_e2) {}
  return "#333333";
}
function clearMermaidLinkSelectStyle(root) {
  var scope = root || previewEl;
  if (!scope) return;
  // Board-like: hit strokes are never painted; force-clear any leftover glow from older builds.
  scope.querySelectorAll("path.mermaid-edge-hit").forEach(function(h) {
    h.classList.remove("mermaid-selection");
    h.classList.remove("mermaid-link-selected");
    h.setAttribute("stroke", "transparent");
    h.setAttribute("fill", "none");
    if (h.style) {
      h.style.removeProperty("stroke");
      h.style.removeProperty("stroke-width");
      h.style.removeProperty("filter");
      h.style.removeProperty("opacity");
    }
  });
  scope.querySelectorAll(".mermaid-link-selected, [data-mermaid-sel-stroke], [data-mermaid-sel-fill]").forEach(function(el) {
    el.classList.remove("mermaid-link-selected");
    if (el.hasAttribute("data-mermaid-sel-stroke")) {
      var prevStroke = el.getAttribute("data-mermaid-sel-stroke");
      var prevWidth = el.getAttribute("data-mermaid-sel-width");
      var prevStyleStroke = el.getAttribute("data-mermaid-sel-style-stroke");
      var prevStyleWidth = el.getAttribute("data-mermaid-sel-style-width");
      if (prevStroke === "") el.removeAttribute("stroke");
      else el.setAttribute("stroke", prevStroke);
      if (prevWidth === "") el.removeAttribute("stroke-width");
      else el.setAttribute("stroke-width", prevWidth);
      if (el.style) {
        if (prevStyleStroke === "") el.style.removeProperty("stroke");
        else el.style.stroke = prevStyleStroke;
        if (prevStyleWidth === "") el.style.removeProperty("stroke-width");
        else el.style.strokeWidth = prevStyleWidth;
        el.style.removeProperty("filter");
        el.style.removeProperty("opacity");
      }
      el.removeAttribute("data-mermaid-sel-stroke");
      el.removeAttribute("data-mermaid-sel-width");
      el.removeAttribute("data-mermaid-sel-style-stroke");
      el.removeAttribute("data-mermaid-sel-style-width");
    }
    if (el.hasAttribute("data-mermaid-sel-fill")) {
      var prevFill = el.getAttribute("data-mermaid-sel-fill");
      var prevStyleFill = el.getAttribute("data-mermaid-sel-style-fill");
      var prevStyleColor = el.getAttribute("data-mermaid-sel-style-color");
      if (prevFill === "") el.removeAttribute("fill");
      else el.setAttribute("fill", prevFill);
      if (el.style) {
        if (prevStyleFill === "") el.style.removeProperty("fill");
        else el.style.fill = prevStyleFill;
        if (prevStyleColor === "") el.style.removeProperty("color");
        else el.style.color = prevStyleColor;
      }
      el.removeAttribute("data-mermaid-sel-fill");
      el.removeAttribute("data-mermaid-sel-style-fill");
      el.removeAttribute("data-mermaid-sel-style-color");
    }
  });
}
function applyMermaidLinkSelectStyle(pathEl) {
  if (!pathEl) return null;
  var base = readMermaidEdgeStroke(pathEl);
  var accent = darkenCssColor(base, 0.4);
  if (!pathEl.hasAttribute("data-mermaid-sel-stroke")) {
    pathEl.setAttribute("data-mermaid-sel-stroke", pathEl.getAttribute("stroke") || "");
    pathEl.setAttribute("data-mermaid-sel-width", pathEl.getAttribute("stroke-width") || "");
    pathEl.setAttribute("data-mermaid-sel-style-stroke", (pathEl.style && pathEl.style.stroke) || "");
    pathEl.setAttribute("data-mermaid-sel-style-width", (pathEl.style && pathEl.style.strokeWidth) || "");
  }
  pathEl.classList.add("mermaid-selection");
  pathEl.classList.add("mermaid-link-selected");
  pathEl.style.stroke = accent;
  pathEl.style.strokeWidth = "2.6px";
  pathEl.style.removeProperty("filter");
  pathEl.style.removeProperty("opacity");
  pathEl.setAttribute("stroke", accent);
  pathEl.setAttribute("stroke-width", "2.6");
  return { base: base, accent: accent };
}
function applyMermaidLinkLabelSelectStyle(labelEl, accent) {
  if (!labelEl || !accent) return;
  labelEl.classList.add("mermaid-selection");
  labelEl.classList.add("mermaid-link-selected");
  if (!labelEl.hasAttribute("data-mermaid-sel-fill")) {
    labelEl.setAttribute("data-mermaid-sel-fill", labelEl.getAttribute("fill") || "");
    labelEl.setAttribute("data-mermaid-sel-style-fill", (labelEl.style && labelEl.style.fill) || "");
    labelEl.setAttribute("data-mermaid-sel-style-color", (labelEl.style && labelEl.style.color) || "");
  }
  labelEl.style.color = accent;
  labelEl.style.fill = accent;
  labelEl.querySelectorAll("span, p, text, tspan").forEach(function(n) {
    if (!n.hasAttribute("data-mermaid-sel-fill")) {
      n.setAttribute("data-mermaid-sel-fill", n.getAttribute("fill") || "");
      n.setAttribute("data-mermaid-sel-style-fill", (n.style && n.style.fill) || "");
      n.setAttribute("data-mermaid-sel-style-color", (n.style && n.style.color) || "");
      n.classList.add("mermaid-link-selected");
    }
    n.style.color = accent;
    if (n.tagName && /text|tspan/i.test(n.tagName)) n.setAttribute("fill", accent);
  });
}

function clearMermaidSelectionVisual() {
  if (!previewEl) return;
  clearMermaidLinkSelectStyle(previewEl);
  previewEl.querySelectorAll(".mermaid-selection, .mermaid-link-source, .mermaid-link-selected").forEach(function(el) {
    el.classList.remove("mermaid-selection");
    el.classList.remove("mermaid-link-source");
    el.classList.remove("mermaid-link-selected");
  });
}

function applyMermaidSelectionVisual() {
  clearMermaidSelectionVisual();
  if (!selectedMermaid || !previewEl) return;
  var sel = selectedMermaid;
  if (sel.domId) {
    var byId = previewEl.querySelector("#" + CSS.escape(sel.domId));
    if (byId) byId.classList.add("mermaid-selection");
  }
  if (sel.kind === "link") {
    var linkSel = sel;
    var prefix = (linkSel.from && linkSel.to) ? ("L_" + linkSel.from + "_" + linkSel.to + "_") : "";
    var accent = null;
    previewEl.querySelectorAll("path.flowchart-link, g.edgePath").forEach(function(el) {
      var path = el;
      if (el.tagName && el.tagName.toLowerCase() === "g") {
        path = el.querySelector("path.flowchart-link, path.path, path") || el;
      }
      var eid = path.id || el.id || "";
      var ok = !!(linkSel.domId && (eid === linkSel.domId || el.id === linkSel.domId));
      if (!ok && prefix && (eid.indexOf(prefix) === 0 || String(el.id || "").indexOf(prefix) === 0)) ok = true;
      if (!ok) return;
      var painted = applyMermaidLinkSelectStyle(path);
      if (painted) accent = painted.accent;
      // Keep hit paths transparent (Board board-edge-hit parity) — no halo/shadow.
    });
    if (typeof FlowchartEdit !== "undefined" && FlowchartEdit.getLink) {
      var info = FlowchartEdit.getLink(sourceEl && sourceEl.value, linkSel.from, linkSel.to);
      var lab = info && info.label ? String(info.label).trim() : "";
      if (lab && accent) {
        previewEl.querySelectorAll("g.edgeLabel").forEach(function(g) {
          if (String(g.textContent || "").replace(/\s+/g, " ").trim() === lab) {
            applyMermaidLinkLabelSelectStyle(g, accent);
          }
        });
      }
    }
  }

  if (sel.kind === "node" && sel.id) {
    previewEl.querySelectorAll("g.node").forEach(function(g) {
      if (g.id && g.id.indexOf("flowchart-" + sel.id + "-") === 0) g.classList.add("mermaid-selection");
    });
  }
  if (sel.kind === "subgraph" && sel.id) {
    previewEl.querySelectorAll("g.cluster").forEach(function(g) {
      var gid = g.id || "";
      if (
        gid === sel.id ||
        gid.indexOf("flowchart-" + sel.id + "-") === 0 ||
        gid === "cluster-" + sel.id ||
        gid.indexOf(sel.id) >= 0
      ) g.classList.add("mermaid-selection");
    });
    previewEl.querySelectorAll("g.cluster-label").forEach(function(g) {
      var gid = g.id || "";
      if (gid.indexOf(sel.id) >= 0) g.classList.add("mermaid-selection");
    });
    // Empty subgraph stand-in is a g.node with id === subgraph id
    previewEl.querySelectorAll("g.node").forEach(function(g) {
      var gid = g.id || "";
      if (gid === sel.id || gid.indexOf("flowchart-" + sel.id + "-") === 0) {
        g.classList.add("mermaid-selection");
      }
    });
  }
  syncMermaidDeleteButton();
}

function clearMermaidSelection() {
  MermaidInspect.clearGesture();
  selectedMermaid = null;
  try { if (sourceEl) delete sourceEl.dataset.mermaidSelectionKey; } catch (_e) {}
  clearMermaidSelectionVisual();
  if (previewEl) previewEl.querySelectorAll("g.mindmap-node.mermaid-selection").forEach(function(el) { el.classList.remove("mermaid-selection"); });
  syncMermaidDeleteButton();
  if (typeof syncMindmapEditButtons === "function") syncMindmapEditButtons();
  else if (typeof syncMindmapDeleteButton === "function") syncMindmapDeleteButton();
  if (typeof syncStateDeleteButton === "function") syncStateDeleteButton();
  if (document.documentElement.dataset.drawerMode === "mermaid" && !mermaidLinkMode) {
    if (propsEmpty) { propsEmpty.hidden = false; propsEmpty.textContent = "Select a node, link, or subgraph"; }
    if (propsFields) propsFields.hidden = true;
    if (propsKindLabel) propsKindLabel.textContent = "—";
    closePropsPanel();
  }
}

function applyMermaidEditResult(result) {
  if (!result || typeof result.source !== "string") return;
  sourceEl.value = result.source;
  selectedMermaid = result.selection || null;
  mermaidLinkStart = null;
  setTypeUI(sourceEl.value);
  void renderDiagram().then(function() {
    if (selectedMermaid && selectedMermaid.kind === "topic") {
      if (typeof applyMindmapSelectionVisual === "function") applyMindmapSelectionVisual();
      if (typeof fillMindmapProps === "function") fillMindmapProps();
      if (typeof syncMindmapEditButtons === "function") syncMindmapEditButtons();
    } else if (typeof isStateMode === "function" && isStateMode()) {
      if (typeof applyStateSelectionVisual === "function") applyStateSelectionVisual();
      if (selectedMermaid && typeof fillStateProps === "function") fillStateProps();
    } else {
      applyMermaidSelectionVisual();
      if (selectedMermaid) fillMermaidProps();
    }
  });
  scheduleSave();
}

function mermaidEditAction(action) {
  try {
    if (typeof FlowchartEdit === "undefined") failMissingFlowchartEdit();
    applyMermaidEditResult(action());
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

function failMissingFlowchartEdit() {
  throw new Error("FlowchartEdit missing — hard refresh (cache)");
}

function setMermaidLinkMode(active) {
  mermaidLinkMode = !!active;
  mermaidLinkStart = null;
  if (mermaidLinkButton) mermaidLinkButton.classList.toggle("is-active", mermaidLinkMode);
  document.documentElement.classList.toggle("mermaid-link-mode", mermaidLinkMode);
  clearMermaidSelectionVisual();
  if (mermaidLinkMode) setStatus("Link mode · click source node, then target");
  else setStatus("Link mode off");
}

function mermaidLinkPick(selection) {
  if (!mermaidLinkMode || !selection || selection.kind !== "node") return false;
  if (!mermaidLinkStart) {
    mermaidLinkStart = selection;
    selectedMermaid = selection;
    applyMermaidSelectionVisual();
    previewEl.querySelectorAll("g.node").forEach(function(g) {
      if (g.id && g.id.indexOf("flowchart-" + selection.id + "-") === 0) g.classList.add("mermaid-link-source");
    });
    setStatus("Source " + selection.id + " · click target");
    return true;
  }
  if (mermaidLinkStart.id === selection.id) {
    setStatus("Pick a different target node", true);
    return true;
  }
  mermaidEditAction(function() {
    return FlowchartEdit.addLink(sourceEl.value, mermaidLinkStart.id, selection.id);
  });
  setMermaidLinkMode(false);
  return true;
}

if (mermaidAddNodeButton) mermaidAddNodeButton.onclick = function() {
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return;
  var opts = {};
  if (selectedMermaid && selectedMermaid.kind === "subgraph" && selectedMermaid.id) {
    opts.parent = selectedMermaid.id;
  }
  mermaidEditAction(function() {
    var result = FlowchartEdit.addNode(sourceEl.value, opts);
    // Keep subgraph selected so Node can be added repeatedly into the same group.
    if (opts.parent) {
      result.selection = { kind: "subgraph", id: opts.parent, key: "subgraph:" + opts.parent };
    }
    return result;
  });
};
if (mermaidAddSubgraphButton) mermaidAddSubgraphButton.onclick = function() {
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return;
  mermaidEditAction(function() { return FlowchartEdit.addSubgraph(sourceEl.value); });
};
if (mermaidLinkButton) mermaidLinkButton.onclick = function() {
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return;
  setMermaidLinkMode(!mermaidLinkMode);
};
if (mermaidDeleteButton) mermaidDeleteButton.onclick = function() {
  if (!selectedMermaid) return;
  mermaidEditAction(function() { return FlowchartEdit.deleteSelection(sourceEl.value, selectedMermaid); });
};

document.addEventListener("keydown", function(event) {
  if (document.documentElement.dataset.drawerMode !== "mermaid") return;
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedMermaid) return;
  var target = event.target;
  if (target === sourceEl || (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
  event.preventDefault();
  mermaidEditAction(function() { return FlowchartEdit.deleteSelection(sourceEl.value, selectedMermaid); });
});

function fillMermaidProps() {
  if (!selectedMermaid || typeof FlowchartEdit === "undefined") return;
  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (boardIconField) boardIconField.hidden = true;
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirLabel) boardDirLabel.hidden = true;
  if (boardDirTip) boardDirTip.hidden = true;
  if (typeof setBoardAlignJustifyFields === "function") setBoardAlignJustifyFields(false);
  if (typeof setBoardCapField === "function") setBoardCapField(false);
  if (typeof setBoardArrowField === "function") setBoardArrowField(false);
  else {
    if (boardArrowField) boardArrowField.hidden = true;
    if (boardArrowEditor) boardArrowEditor.hidden = true;
    if (boardArrowLabel) boardArrowLabel.hidden = true;
    if (boardArrowReverse) boardArrowReverse.hidden = true;
  }
  var kind = selectedMermaid.kind;
  if (propsKindLabel) propsKindLabel.textContent = kind;
  if (kind === "node") {
    var node = FlowchartEdit.getNode(sourceEl.value, selectedMermaid.id) || { id: selectedMermaid.id, label: selectedMermaid.id, shape: "rect", nodeKind: "default" };
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Label"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.value = node.label || "";
      boardTitleEditor.rows = 1;
      boardTitleEditor.classList.remove("is-multiline");
    }
    if (boardTypeLabel) { boardTypeLabel.hidden = false; boardTypeLabel.textContent = "Type"; }
    if (boardTypeEditor) {
      var kinds = [
        { value: "default", label: "default" },
        { value: "start", label: "start" },
        { value: "end", label: "end" },
        { value: "judgment", label: "judgment" },
      ];
      var curKind = node.nodeKind || (typeof FlowchartEdit.kindFromShape === "function" ? FlowchartEdit.kindFromShape(node.shape, node.label) : "default");
      if (curKind === "node") curKind = "default";
      if (typeof FlowchartEdit.normalizeNodeKind === "function") curKind = FlowchartEdit.normalizeNodeKind(curKind);
      boardTypeEditor.hidden = false;
      boardTypeEditor.disabled = false;
      boardTypeEditor.innerHTML = kinds.map(function(k){ return "<option value=\"" + k.value + "\">" + k.label + "</option>"; }).join("");
      boardTypeEditor.value = kinds.some(function(k){ return k.value === curKind; }) ? curKind : "default";
    }
    if (typeof setBoardIdField === "function") setBoardIdField(true, node.id || selectedMermaid.id);
    if (propsHint) propsHint.textContent = "Type changes the shape: default box, start/end rounded, judgment diamond";
  } else if (kind === "link") {
    var link = FlowchartEdit.getLink(sourceEl.value, selectedMermaid.from, selectedMermaid.to) || { label: "", stroke: "solid" };
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Title"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.value = link.label || "";
      boardTitleEditor.rows = 1;
      boardTitleEditor.classList.remove("is-multiline");
    }
    if (boardTypeLabel) { boardTypeLabel.hidden = false; boardTypeLabel.textContent = "Stroke"; }
    if (boardTypeEditor) {
      boardTypeEditor.hidden = false;
      boardTypeEditor.disabled = false;
      boardTypeEditor.innerHTML = '<option value="solid">solid</option><option value="dotted">dotted</option>';
      boardTypeEditor.value = (link.stroke === "dotted" || link.stroke === "dashed") ? "dotted" : "solid";
    }
    if (typeof setBoardIdField === "function") setBoardIdField(false);
    if (propsHint) propsHint.textContent = "Edit the link title and stroke; shown on the connector between the two nodes";
  } else if (kind === "subgraph") {
    var sg = FlowchartEdit.getSubgraph(sourceEl.value, selectedMermaid.id) || { id: selectedMermaid.id, title: selectedMermaid.id };
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Title"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.value = sg.title || "";
      boardTitleEditor.rows = 1;
    }
    if (boardTypeEditor) boardTypeEditor.hidden = true;
    if (boardTypeLabel) boardTypeLabel.hidden = true;
    if (typeof setBoardIdField === "function") setBoardIdField(true, sg.id || selectedMermaid.id);
    if (propsHint) propsHint.textContent = "Group selected · Node adds inside this group; edit title or id";
  }
}

function selectMermaidHit(sel, openInspect) {
  if (!sel) { clearMermaidSelection(); return; }
  var key = sel.key;
  var already = key && key === currentMermaidSelectionKey();
  if (!already && !mermaidLinkMode) closePropsPanel();
  selectedMermaid = sel;
  try { if (sourceEl) sourceEl.dataset.mermaidSelectionKey = key || ""; } catch (_e) {}
  applyMermaidSelectionVisual();
  syncMermaidDeleteButton();
  fillMermaidProps();
  setStatus("Selected " + sel.kind + (sel.id ? (" " + sel.id) : (sel.from && sel.to ? (" " + sel.from + "→" + sel.to) : "")));
  if (openInspect) inspectMermaidSelection();
}

/** Board pickBoardElement parity: record gesture + select, never open Props here. */
function pickMermaidHit(sel) {
  if (!sel) { clearMermaidSelection(); return; }
  beginMermaidInspectGesture(sel.key);
  selectMermaidHit(sel, false);
}

/**
 * Mermaid Props UX (Board re-press):
 * 1) First click → select only.
 * 2) Re-click same selected target → open Props.
 * 3) Props open and already showing that target → noop.
 * 4) Props open but showing another target → refresh fill, keep open.
 *
 * Critical: do NOT open on the trailing `click` of a first-select.
 * Board uses gesture.already captured on pointerdown BEFORE select;
 * the same physical click's `click` event must not treat "now selected" as re-press.
 */
function mermaidWantPropsForKey(key) {
  MermaidInspect.wantProps(key, {
    blocked: !!mermaidLinkMode,
    fill: function() { fillMermaidProps(); },
  });
}

function mermaidHitSelect(event) {
  if (document.documentElement.dataset.drawerMode !== "mermaid") return false;
  if (document.documentElement.dataset.mermaidMindmap === "1") return false;
  if (document.documentElement.dataset.mermaidFlowchart !== "1") return false;
  if (typeof FlowchartEdit === "undefined" || typeof FlowchartEdit.selectionFromDom !== "function") return false;
  if (event.target.closest && event.target.closest(".top-float, .menu, .sheet, .board-dock, .zoom-float, button, input, textarea, select")) return false;
  var sel = FlowchartEdit.selectionFromDom(event.target, sourceEl && sourceEl.value);
  if (mermaidLinkMode) {
    event.preventDefault();
    event.stopPropagation();
    if (sel && sel.kind === "node") mermaidLinkPick(sel);
    else if (!sel) setMermaidLinkMode(false);
    return true;
  }
  if (event.type !== "pointerdown" && event.type !== "click" && event.type !== "dblclick") {
    return !!sel;
  }
  if (!sel) {
    if (event.type === "pointerdown") {
      MermaidInspect.clearGesture();
      clearMermaidSelection();
    }
    return false;
  }
  var key = sel.key || "";
  if (event.type === "pointerdown") {
    // Capture already BEFORE select (Board beginInspectGesture).
    pickMermaidHit(sel);
    if (mermaidInspectGesture && mermaidInspectGesture.already) {
      mermaidWantPropsForKey(key);
      MermaidInspect.clearGesture();
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.type === "click") {
    // Only re-press if pointerdown marked already (never first-select's click).
    if (consumeMermaidInspectClick(key)) mermaidWantPropsForKey(key);
    event.stopPropagation();
    return true;
  }
  if (event.type === "dblclick") {
    pickMermaidHit(sel);
    mermaidWantPropsForKey(key);
    MermaidInspect.clearGesture();
    if (boardTitleEditor && !boardTitleEditor.hidden) { boardTitleEditor.focus(); boardTitleEditor.select(); }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return true;
}
previewEl.addEventListener("pointerdown", function(event) {
  if (event.button !== 0) return;
  mermaidHitSelect(event);
}, true);
previewEl.addEventListener("click", function(event) {
  if (document.documentElement.dataset.drawerMode !== "mermaid") return;
  if (mermaidLinkMode) return;
  mermaidHitSelect(event);
}, true);
previewEl.addEventListener("dblclick", function(event) {
  if (document.documentElement.dataset.drawerMode !== "mermaid") return;
  mermaidHitSelect(event);
}, true);


/* ── Mindmap edit: hover + to add child; Delete; select / Props ─ */
const mindmapDeleteButton = $("#btnMindmapDelete");

