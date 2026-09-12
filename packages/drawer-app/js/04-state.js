/* drawer-app/04-state.js — state diagram select / Props (S4+). */

function isStateMode() {
  return document.documentElement.dataset.drawerMode === "mermaid"
    && document.documentElement.dataset.mermaidState === "1";
}

function applyStateSelectionVisual() {
  clearMermaidSelectionVisual();
  if (!selectedMermaid || !previewEl || !isStateMode()) return;
  var sel = selectedMermaid;
  if (sel.domId) {
    try {
      var byId = previewEl.querySelector("#" + CSS.escape(sel.domId));
      if (byId) byId.classList.add("mermaid-selection");
    } catch (_e) {}
  }
  if (sel.kind === "state" && sel.id) {
    previewEl.querySelectorAll("g.node.statediagram-state, g.node").forEach(function(g) {
      var gid = g.id || "";
      if (gid.indexOf("state-" + sel.id + "-") === 0) g.classList.add("mermaid-selection");
    });
  }
  if (sel.kind === "composite" && sel.id) {
    previewEl.querySelectorAll("g.statediagram-cluster").forEach(function(g) {
      if (g.id === sel.id) {
        g.classList.add("mermaid-selection");
        var lab = g.querySelector(":scope > g.cluster-label");
        if (lab) lab.classList.add("mermaid-selection");
      }
    });
    // classic
    previewEl.querySelectorAll("g.stateGroup").forEach(function(g) {
      if (g.id === sel.id) g.classList.add("mermaid-selection");
    });
  }
  if (sel.kind === "pseudostate") {
    if (sel.domId) {
      try {
        var ps = previewEl.querySelector("#" + CSS.escape(sel.domId));
        if (ps) ps.classList.add("mermaid-selection");
      } catch (_e2) {}
    }
  }
  if (sel.kind === "transition") {
    var accent = null;
    var list = (typeof StateEdit !== "undefined" && StateEdit.listTransitions)
      ? StateEdit.listTransitions(sourceEl && sourceEl.value)
      : [];
    var idx = -1;
    // Prefer exact line / key so duplicate [*]-->X edges don't share selection chrome.
    if (sel.line != null && sel.line >= 0) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].line === sel.line) { idx = i; break; }
      }
    }
    if (idx < 0 && sel.key) {
      for (var k = 0; k < list.length; k++) {
        if (list[k].key === sel.key) { idx = k; break; }
      }
    }
    if (idx < 0) {
      for (var j = 0; j < list.length; j++) {
        if (list[j].from === sel.from && list[j].to === sel.to) { idx = j; break; }
      }
    }
    var paths = previewEl.querySelectorAll("path.transition");
    if (idx >= 0 && paths[idx]) {
      var painted = typeof applyMermaidLinkSelectStyle === "function"
        ? applyMermaidLinkSelectStyle(paths[idx])
        : null;
      if (painted) accent = painted.accent;
      paths[idx].classList.add("mermaid-selection");
      var hits = previewEl.querySelectorAll("path.mermaid-edge-hit");
      if (hits[idx]) hits[idx].classList.add("mermaid-selection");
    } else if (sel.domId) {
      try {
        var p = previewEl.querySelector("#" + CSS.escape(sel.domId));
        if (p) {
          if (typeof applyMermaidLinkSelectStyle === "function") {
            var painted2 = applyMermaidLinkSelectStyle(p);
            if (painted2) accent = painted2.accent;
          }
          p.classList.add("mermaid-selection");
        }
      } catch (_e3) {}
    }
    // Style only the matching edgeLabel at the same index (not every duplicate "create").
    if (idx >= 0 && accent && typeof applyMermaidLinkLabelSelectStyle === "function") {
      var labels = previewEl.querySelectorAll("g.edgeLabel");
      if (labels[idx]) applyMermaidLinkLabelSelectStyle(labels[idx], accent);
    }
  }
}

/** Minimal Props for S4 (S6 expands fields). */
function fillStateProps() {
  if (!isStateMode() || !selectedMermaid) return;
  var sel = selectedMermaid;
  var info = null;
  try {
    if ((sel.kind === "state" || sel.kind === "composite" || sel.kind === "pseudostate") && typeof StateEdit !== "undefined" && StateEdit.getState) {
      info = StateEdit.getState(sourceEl.value, sel.id);
    } else if (sel.kind === "transition" && typeof StateEdit !== "undefined" && StateEdit.getTransition) {
      info = StateEdit.getTransition(sourceEl.value, sel.from, sel.to);
    }
  } catch (_e) { info = null; }

  if (propsEmpty) propsEmpty.hidden = true;
  if (propsFields) propsFields.hidden = false;
  if (propsKindLabel) propsKindLabel.textContent = sel.kind || "state";
  // State transitions have no stroke/direction UI (flowchart-only).
  if (boardDirEditor) boardDirEditor.hidden = true;
  if (boardDirLabel) boardDirLabel.hidden = true;
  if (boardDirTip) boardDirTip.hidden = true;
  if (typeof setBoardAlignJustifyFields === "function") setBoardAlignJustifyFields(false);
  if (typeof setBoardCapField === "function") setBoardCapField(false);
  if (typeof setBoardArrowField === "function") setBoardArrowField(false);

  if (sel.kind === "transition") {
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Label"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.readOnly = false;
      boardTitleEditor.value = (info && info.label != null) ? info.label : (sel.label || "");
      boardTitleEditor.rows = 1;
    }
    if (boardTypeEditor) boardTypeEditor.hidden = true;
    if (boardTypeLabel) boardTypeLabel.hidden = true;
    if (typeof setBoardIdField === "function") setBoardIdField(false);
    if (propsHint) propsHint.textContent = (sel.from || "") + " → " + (sel.to || "") + " · edit label";
  } else if (sel.kind === "pseudostate") {
    if (boardTitleLabel) { boardTitleLabel.hidden = false; boardTitleLabel.textContent = "Label"; }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.readOnly = true;
      boardTitleEditor.value = "[*]";
      boardTitleEditor.rows = 1;
    }
    if (boardTypeEditor) boardTypeEditor.hidden = true;
    if (boardTypeLabel) boardTypeLabel.hidden = true;
    if (typeof setBoardIdField === "function") setBoardIdField(true, "[*]");
    if (boardIdEditor) boardIdEditor.readOnly = true;
    if (propsHint) propsHint.textContent = (sel.parent ? ("Inside " + sel.parent + " · ") : "") + "Start/end · read-only";
  } else {
    // state | composite
    if (boardTitleLabel) {
      boardTitleLabel.hidden = false;
      boardTitleLabel.textContent = sel.kind === "composite" ? "Title" : "Label";
    }
    if (boardTitleEditor) {
      boardTitleEditor.hidden = false;
      boardTitleEditor.readOnly = false;
      boardTitleEditor.value = (info && info.label != null) ? info.label : (sel.label || sel.id || "");
      boardTitleEditor.rows = 1;
    }
    if (boardTypeEditor) boardTypeEditor.hidden = true;
    if (boardTypeLabel) boardTypeLabel.hidden = true;
    if (typeof setBoardIdField === "function") setBoardIdField(true, (info && info.id) || sel.id || "");
    if (boardIdEditor) boardIdEditor.readOnly = false;
    if (propsHint) {
      propsHint.textContent = sel.kind === "composite"
        ? "Composite · edit title or id; Node/State adds can nest later"
        : "State · edit label or id";
    }
  }
  syncStateDeleteButton();
}

function selectStateHit(sel, openInspect) {
  if (!sel) { clearMermaidSelection(); return; }
  var key = sel.key;
  var already = key && key === currentMermaidSelectionKey();
  if (!already) closePropsPanel();
  selectedMermaid = sel;
  try { if (sourceEl) sourceEl.dataset.mermaidSelectionKey = key || ""; } catch (_e) {}
  applyStateSelectionVisual();
  fillStateProps();
  var statusBits = sel.kind;
  if (sel.id) statusBits += " " + sel.id;
  else if (sel.from && sel.to) statusBits += " " + sel.from + "→" + sel.to;
  setStatus("Selected " + statusBits);
  if (openInspect) {
    MermaidInspect.inspect({
      fill: function() { fillStateProps(); },
    });
  }
}

function stateWantPropsForKey(key) {
  MermaidInspect.wantProps(key, {
    blocked: !isStateMode(),
    fill: function() { fillStateProps(); },
  });
}

function stateHitSelect(event) {
  if (!isStateMode()) return false;
  if (typeof StateEdit === "undefined" || typeof StateEdit.selectionFromDom !== "function") return false;
  if (event.target.closest && event.target.closest(".top-float, .menu, .sheet, .board-dock, .zoom-float, button, input, textarea, select")) return false;
  var sel = StateEdit.selectionFromDom(event.target, sourceEl && sourceEl.value);
  if (mermaidLinkMode) {
    event.preventDefault();
    event.stopPropagation();
    if (sel && (sel.kind === "state" || sel.kind === "composite")) stateLinkPick(sel);
    else if (!sel) setMermaidLinkMode(false);
    return true;
  }
  if (event.type !== "pointerdown" && event.type !== "click" && event.type !== "dblclick") return !!sel;
  if (!sel) {
    if (event.type === "pointerdown") {
      MermaidInspect.clearGesture();
      clearMermaidSelection();
    }
    return false;
  }
  var key = sel.key || "";
  if (event.type === "pointerdown") {
    beginMermaidInspectGesture(key);
    selectStateHit(sel, false);
    if (mermaidInspectGesture && mermaidInspectGesture.already) {
      stateWantPropsForKey(key);
      MermaidInspect.clearGesture();
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  if (event.type === "click") {
    if (consumeMermaidInspectClick(key)) stateWantPropsForKey(key);
    event.stopPropagation();
    return true;
  }
  if (event.type === "dblclick") {
    selectStateHit(sel, false);
    stateWantPropsForKey(key);
    MermaidInspect.clearGesture();
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  return true;
}


function stateEditAction(fn) {
  if (typeof StateEdit === "undefined") throw new Error("StateEdit missing — hard refresh");
  var result = fn();
  if (!result || typeof result.source !== "string") return;
  sourceEl.value = result.source;
  selectedMermaid = result.selection || null;
  setTypeUI(sourceEl.value);
  void renderDiagram().then(function() {
    if (selectedMermaid) {
      applyStateSelectionVisual();
      fillStateProps();
    }
  });
  scheduleSave();
}


function syncStateDeleteButton() {
  var btn = document.getElementById("btnStateDelete");
  if (!btn) return;
  var on = isStateMode() && selectedMermaid && selectedMermaid.kind !== "pseudostate";
  btn.disabled = !on;
  syncStateStartButton();
}

function stateLinkPick(selection) {
  if (!mermaidLinkMode || !selection) return false;
  if (selection.kind !== "state" && selection.kind !== "composite") return false;
  if (!mermaidLinkStart) {
    mermaidLinkStart = selection;
    selectedMermaid = selection;
    applyStateSelectionVisual();
    if (selection.domId) {
      try {
        var el = previewEl.querySelector("#" + CSS.escape(selection.domId));
        if (el) el.classList.add("mermaid-link-source");
      } catch (_e) {}
    }
    setStatus("Source " + selection.id + " · click target");
    return true;
  }
  if (mermaidLinkStart.id === selection.id) {
    setStatus("Pick a different target state", true);
    return true;
  }
  try {
    stateEditAction(function() {
      return StateEdit.addTransition(sourceEl.value, mermaidLinkStart.id, selection.id, "");
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
  setMermaidLinkMode(false);
  return true;
}

function stateAddState() {
  if (!isStateMode()) return;
  var parent = (selectedMermaid && selectedMermaid.kind === "composite") ? selectedMermaid.id : "";
  try {
    stateEditAction(function() {
      return StateEdit.addState(sourceEl.value, { label: "state", parent: parent || undefined });
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

function stateAddComposite() {
  if (!isStateMode()) return;
  var parent = (selectedMermaid && selectedMermaid.kind === "composite") ? selectedMermaid.id : "";
  try {
    stateEditAction(function() {
      return StateEdit.addComposite(sourceEl.value, { label: "Group", parent: parent || undefined });
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

/** Group for Start: selected state's rendered composite (bbox), else canvas. */
function startGroupForSelection(sel) {
  if (!sel || sel.kind !== "state") return null;
  if (sel.parent) return String(sel.parent);
  var node = null;
  if (previewEl && sel.domId) {
    try { node = previewEl.querySelector("#" + CSS.escape(sel.domId)); } catch (_e) {}
  }
  if (!node && previewEl && sel.id) {
    previewEl.querySelectorAll("g.node").forEach(function(g) {
      if (node) return;
      var gid = g.id || "";
      if (gid.indexOf("state-" + sel.id + "-") === 0) node = g;
    });
  }
  if (node) {
    if (typeof StateEdit !== "undefined" && StateEdit.clusterParentFromDom) {
      return StateEdit.clusterParentFromDom(node) || "";
    }
    try {
      var cluster = node.closest && node.closest("g.statediagram-cluster");
      if (cluster && cluster.id) return cluster.id;
    } catch (_e2) {}
  }
  return "";
}

function syncStateStartButton() {
  var btn = document.getElementById("btnStateAddStart");
  if (!btn) return;
  if (!isStateMode() || typeof StateEdit === "undefined" || !StateEdit.hasStart || !StateEdit.addStart) {
    btn.disabled = true;
    return;
  }
  var sel = selectedMermaid;
  if (!sel || sel.kind !== "state" || !sel.id || sel.id === "[*]") {
    btn.disabled = true;
    btn.title = "Select a state, then add start [*] → it";
    return;
  }
  var parent = startGroupForSelection(sel);
  if (parent == null) {
    btn.disabled = true;
    btn.title = "Select a state, then add start [*] → it";
    return;
  }
  var src = sourceEl && sourceEl.value;
  var blocked = false;
  var reason = "";
  try {
    if (StateEdit.hasStart(src, parent)) {
      blocked = true;
      reason = "Start already exists in " + (parent || "canvas");
    } else if (StateEdit.getTransition && StateEdit.getTransition(src, "[*]", sel.id)) {
      blocked = true;
      reason = "A start already points to " + sel.id;
    }
  } catch (_e2) {
    blocked = true;
    reason = "Cannot add start";
  }
  btn.disabled = !!blocked;
  btn.title = blocked
    ? reason
    : ("Add [*] → " + sel.id + " in " + (parent || "canvas"));
}

function stateAddStart() {
  if (!isStateMode()) return;
  var sel = selectedMermaid;
  if (!sel || sel.kind !== "state" || !sel.id) {
    showMermaidError("Select a state first, then add Start");
    return;
  }
  var parent = startGroupForSelection(sel);
  if (parent == null) {
    showMermaidError("Select a state first, then add Start");
    return;
  }
  try {
    stateEditAction(function() {
      return StateEdit.addStart(sourceEl.value, {
        to: sel.id,
        parent: parent || undefined,
      });
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

function stateDeleteSelection() {
  if (!isStateMode() || !selectedMermaid) return;
  if (selectedMermaid.kind === "pseudostate") return;
  try {
    stateEditAction(function() {
      return StateEdit.deleteSelection(sourceEl.value, selectedMermaid);
    });
  } catch (err) {
    showMermaidError(err instanceof Error ? err.message : String(err));
  }
}

(function wireStateTools() {
  var addBtn = document.getElementById("btnStateAdd");
  var groupBtn = document.getElementById("btnStateAddGroup");
  var linkBtn = document.getElementById("btnStateLink");
  var delBtn = document.getElementById("btnStateDelete");
  if (addBtn) addBtn.onclick = function() { stateAddState(); };
  if (groupBtn) groupBtn.onclick = function() { stateAddComposite(); };
  var startBtn = document.getElementById("btnStateAddStart");
  if (startBtn) startBtn.onclick = function() { stateAddStart(); };
  if (linkBtn) {
    linkBtn.onclick = function() { setMermaidLinkMode(!mermaidLinkMode); };
    if (!setMermaidLinkMode._stateLinkHooked) {
      var _set = setMermaidLinkMode;
      setMermaidLinkMode = function(active) {
        _set(active);
        var b = document.getElementById("btnStateLink");
        if (b) b.classList.toggle("is-active", !!mermaidLinkMode);
      };
      setMermaidLinkMode._stateLinkHooked = true;
    }
  }
  if (delBtn) delBtn.onclick = function() { stateDeleteSelection(); };
  syncStateDeleteButton();
})();

if (previewEl) {
  previewEl.addEventListener("pointerdown", function(event) {
    if (event.button !== 0) return;
    stateHitSelect(event);
  }, true);
  previewEl.addEventListener("click", function(event) {
    if (!isStateMode()) return;
    stateHitSelect(event);
  }, true);
  previewEl.addEventListener("dblclick", function(event) {
    if (!isStateMode()) return;
    stateHitSelect(event);
  }, true);
}

document.addEventListener("keydown", function(event) {
  if (!isStateMode()) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (!selectedMermaid || selectedMermaid.kind === "pseudostate") return;
  var tag = (event.target && event.target.tagName) || "";
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
  event.preventDefault();
  stateDeleteSelection();
});

