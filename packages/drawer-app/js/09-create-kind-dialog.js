/* drawer-app/09-create-kind-dialog.js — pick a listed type. Does not write hash or source. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.openCreateKindDialog = api.openCreateKindDialog;
  root.closeCreateKindDialog = api.closeCreateKindDialog;
  root.CREATE_KIND_ITEMS = api.CREATE_KIND_ITEMS;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CREATE_KIND_ITEMS = [
    { cls: "Welcome", name: "Welcome", note: "Onboarding board", ready: true, kind: "welcome" },
    { cls: "Sketch", name: "Sketch", note: "Figurative board", ready: true, kind: "sketch" },
    { cls: "Boxes", name: "Boxes", note: "Structured whiteboard", ready: true, kind: "boxes" },
    { cls: "Mermaid", name: "Flowchart", note: "flow", ready: true, kind: "flowchart" },
    { cls: "Mermaid", name: "Block", note: "flow", ready: false, kind: "block-beta" },
    { cls: "Mermaid", name: "Mindmap", note: "flow", ready: true, kind: "mindmap" },
    { cls: "Mermaid", name: "Architecture", note: "flow", ready: false, kind: "architecture" },
    { cls: "Mermaid", name: "Swimlane", note: "flow", ready: false, kind: "swimlane-beta" },
    { cls: "Mermaid", name: "Agentflow", note: "flow", ready: false, kind: "agentflow-beta" },
    { cls: "Mermaid", name: "Tree View", note: "flow", ready: false, kind: "treeView-beta" },
    { cls: "Mermaid", name: "Sequence", note: "design", ready: true, kind: "sequenceDiagram" },
    { cls: "Mermaid", name: "Class", note: "design", ready: true, kind: "classDiagram" },
    { cls: "Mermaid", name: "State", note: "design", ready: true, kind: "stateDiagram" },
    { cls: "Mermaid", name: "ER", note: "design", ready: true, kind: "erDiagram" },
    { cls: "Mermaid", name: "Requirement", note: "design", ready: true, kind: "requirement" },
    { cls: "Mermaid", name: "C4", note: "design", ready: true, kind: "C4Context" },
    { cls: "Mermaid", name: "Use Case", note: "design", ready: true, kind: "usecase-beta" },
    { cls: "Mermaid", name: "Event Modeling", note: "design", ready: true, kind: "eventmodeling" },
    { cls: "Mermaid", name: "Railroad", note: "design", ready: true, kind: "railroad-beta" },
    { cls: "Mermaid", name: "Gantt", note: "time", ready: false, kind: "gantt" },
    { cls: "Mermaid", name: "Journey", note: "time", ready: false, kind: "journey" },
    { cls: "Mermaid", name: "Timeline", note: "time", ready: false, kind: "timeline" },
    { cls: "Mermaid", name: "Git Graph", note: "time", ready: false, kind: "gitGraph" },
    { cls: "Mermaid", name: "Kanban", note: "time", ready: false, kind: "kanban" },
    { cls: "Mermaid", name: "Pie", note: "chart", ready: false, kind: "pie" },
    { cls: "Mermaid", name: "Quadrant", note: "chart", ready: false, kind: "quadrantChart" },
    { cls: "Mermaid", name: "XY Chart", note: "chart", ready: false, kind: "xychart-beta" },
    { cls: "Mermaid", name: "Sankey", note: "chart", ready: false, kind: "sankey-beta" },
    { cls: "Mermaid", name: "Packet", note: "chart", ready: false, kind: "packet-beta" },
    { cls: "Mermaid", name: "Radar", note: "chart", ready: false, kind: "radar-beta" },
    { cls: "Mermaid", name: "Treemap", note: "chart", ready: false, kind: "treemap" },
    { cls: "Mermaid", name: "Cynefin", note: "map", ready: false, kind: "cynefin-beta" },
    { cls: "Mermaid", name: "Wardley", note: "map", ready: false, kind: "wardley-beta" },
    { cls: "Mermaid", name: "Venn", note: "map", ready: false, kind: "venn-beta" },
    { cls: "Mermaid", name: "Ishikawa", note: "map", ready: false, kind: "ishikawa" },
  ];

  var MERMAID_NOTES = ["design", "flow", "chart", "map", "time"];
  var createKindWait = null;
  var createKindPicked = "";
  var mermaidOpen = false;
  var noteRailPinned = "";
  var noteRailLock = 0;

  function createKindEls() {
    return {
      root: document.getElementById("createKindDialog"),
      list: document.getElementById("createKindList"),
      filter: document.getElementById("createKindFilter"),
      backdrop: document.getElementById("createKindBackdrop"),
    };
  }

  function createKindQuery() {
    var els = createKindEls();
    return els.filter ? String(els.filter.value || "").trim().toLowerCase() : "";
  }

  function createKindRowHtml(it) {
    var spot = it.kind === "welcome";
    var cls = "create-kind-row" + (spot ? " create-kind-spot" : "") + (it.kind === createKindPicked ? " is-picked" : "");
    var note = it.cls === "Mermaid" ? "" : "<span>" + it.note + "</span>";
    var title = "<b>" + it.name + "</b>";
    if (spot) {
      title = "<span class=\"create-kind-spot-head\">" + title
        + "<i class=\"create-kind-spot-mark\" aria-hidden=\"true\"></i></span>";
    }
    return "<button type=\"button\" class=\"" + cls + "\" data-create-kind=\"" + it.kind + "\""
      + (it.ready ? "" : " disabled") + ">"
      + "<span class=\"create-kind-main\">" + title + note + "</span></button>";
  }

  function createKindNoteTitle(note) {
    return note.charAt(0).toUpperCase() + note.slice(1);
  }

  function createKindGroupHtml(name, open) {
    return "<details class=\"create-kind-group\" data-create-kind-group=\"" + name + "\""
      + (open ? " open" : "") + ">"
      + "<summary class=\"create-kind-label\">" + name + "</summary>";
  }

  function createKindNoteStep(list) {
    var row = list.querySelector(".create-kind-note-block .create-kind-row");
    var h = row && row.getBoundingClientRect ? row.getBoundingClientRect().height : 0;
    return h > 0 ? h : 36;
  }

  function markCreateKindNote(rail, current) {
    var nodes = (rail.parentNode || rail).querySelectorAll("[data-create-kind-note], [data-create-kind-note-jump]");
    for (var j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      if (node.classList && node.classList.toggle) {
        node.classList.toggle("is-current", (node.getAttribute("data-create-kind-note-jump") || node.getAttribute("data-create-kind-note") || "") === current);
      }
    }
  }

  function pinCreateKindNote(title, list) {
    noteRailPinned = title || "";
    noteRailLock = list && typeof list.scrollTop === "number" ? list.scrollTop : 0;
  }

  function syncCreateKindNoteRail() {
    var els = createKindEls();
    if (!els.list || typeof els.list.querySelector !== "function") return;
    var rail = els.list.querySelector(".create-kind-note-rail");
    if (!rail || typeof rail.querySelectorAll !== "function") return;
    var blocks = els.list.querySelectorAll(".create-kind-note-block");
    var current = blocks.length ? blocks[0].getAttribute("data-create-kind-note") || "" : "";
    var step = createKindNoteStep(els.list);
    if (noteRailPinned && Math.abs((els.list.scrollTop || 0) - noteRailLock) < step) {
      current = noteRailPinned;
    } else if (els.list.getBoundingClientRect && blocks.length) {
      noteRailPinned = "";
      var view = els.list.getBoundingClientRect();
      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        if (!block.getBoundingClientRect) continue;
        var r = block.getBoundingClientRect();
        var vis = Math.min(r.bottom, view.bottom) - Math.max(r.top, view.top);
        if (vis >= step) {
          current = block.getAttribute("data-create-kind-note") || "";
        }
      }
    }
    markCreateKindNote(rail, current);
  }

  function jumpCreateKindNote(title) {
    var els = createKindEls();
    if (!els.list || typeof els.list.querySelector !== "function") return;
    var block = els.list.querySelector(".create-kind-note-block[data-create-kind-note=\"" + title + "\"]");
    if (block && typeof block.scrollIntoView === "function") block.scrollIntoView({ block: "start" });
    pinCreateKindNote(title, els.list);
    var rail = els.list.querySelector(".create-kind-note-rail");
    if (rail) markCreateKindNote(rail, title);
  }

  function paintCreateKindList() {
    var els = createKindEls();
    if (!els.list) return;
    var q = createKindQuery();
    var html = "";
    var n = 0;
    var lastCls = "";
    var mermaidByNote = {};
    CREATE_KIND_ITEMS.forEach(function (it) {
      var hay = (it.cls + " " + it.name + " " + it.note).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      if (q || it.cls !== "Mermaid") {
        if (!q && it.cls !== lastCls && it.cls !== "Welcome") {
          html += "<div class=\"create-kind-label\">" + it.cls + "</div>";
          lastCls = it.cls;
        }
        html += createKindRowHtml(it);
        n += 1;
        return;
      }
      if (!mermaidByNote[it.note]) mermaidByNote[it.note] = [];
      mermaidByNote[it.note].push(it);
    });
    var notes = MERMAID_NOTES.filter(function (note) {
      return mermaidByNote[note] && mermaidByNote[note].length;
    });
    if (notes.length) {
      var blocks = "";
      var jumps = "";
      notes.forEach(function (note) {
        var title = createKindNoteTitle(note);
        blocks += "<div class=\"create-kind-note-block\" data-create-kind-note=\"" + title + "\">";
        mermaidByNote[note].forEach(function (it) {
          blocks += createKindRowHtml(it);
          n += 1;
        });
        blocks += "</div>";
        jumps += "<button type=\"button\" class=\"create-kind-note-jump\" data-create-kind-note-jump=\"" + title + "\">" + title + "</button>";
      });
      html += createKindGroupHtml("Mermaid", mermaidOpen)
        + "<div class=\"create-kind-mermaid\"><div class=\"create-kind-mermaid-list\">" + blocks
        + "</div><nav class=\"create-kind-note-rail\" aria-label=\"Mermaid categories\">" + jumps
        + "</nav></div></details>";
    }
    els.list.innerHTML = n ? html : "<div class=\"create-kind-empty\">No types match</div>";
    pinCreateKindNote(notes.length ? createKindNoteTitle(notes[0]) : "", els.list);
    if (!q) syncCreateKindNoteRail();
  }

  function createKindRowFromNode(node, list) {
    while (node && node !== list) {
      if (node.getAttribute && node.getAttribute("data-create-kind")) return node;
      node = node.parentNode;
    }
    return null;
  }

  function clearCreateKindHover(list) {
    if (!list || !list.querySelectorAll) return;
    var rows = list.querySelectorAll(".create-kind-row.is-hover");
    for (var i = 0; i < rows.length; i++) rows[i].classList.remove("is-hover");
  }

  function hoverCreateKindRow(list, row) {
    clearCreateKindHover(list);
    if (!row || !row.classList) return;
    row.classList.add("is-hover");
    var block = row;
    while (block && block !== list) {
      var title = block.getAttribute && block.getAttribute("data-create-kind-note");
      if (title) {
        pinCreateKindNote(title, list);
        var rail = list.querySelector(".create-kind-note-rail");
        if (rail) markCreateKindNote(rail, title);
        break;
      }
      block = block.parentNode;
    }
  }

  function createKindCleanup() {
    var els = createKindEls();
    if (els.root) els.root.hidden = true;
    if (els.list && els.list._createKindPick) els.list.removeEventListener("click", els.list._createKindPick);
    if (els.list && els.list._createKindToggle) els.list.removeEventListener("toggle", els.list._createKindToggle, true);
    if (els.list && els.list._createKindScroll) els.list.removeEventListener("scroll", els.list._createKindScroll);
    if (els.list && els.list._createKindPointer) els.list.removeEventListener("pointermove", els.list._createKindPointer);
    if (els.list && els.list._createKindPointerLeave) els.list.removeEventListener("pointerleave", els.list._createKindPointerLeave);
    if (els.filter && els.filter._createKindFilter) els.filter.removeEventListener("input", els.filter._createKindFilter);
    if (els.backdrop && els.backdrop._createKindCancel) els.backdrop.removeEventListener("click", els.backdrop._createKindCancel);
    document.removeEventListener("keydown", createKindOnKey);
    if (els.list) {
      els.list._createKindPick = null;
      els.list._createKindToggle = null;
      els.list._createKindScroll = null;
      els.list._createKindPointer = null;
      els.list._createKindPointerLeave = null;
    }
    if (els.filter) els.filter._createKindFilter = null;
    if (els.backdrop) els.backdrop._createKindCancel = null;
  }

  function createKindOnKey(event) {
    if (!event || event.key !== "Escape") return;
    event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    if (createKindWait) createKindWait("cancel");
  }

  function closeCreateKindDialog() {
    if (createKindWait) createKindWait("cancel");
    else createKindCleanup();
  }

  function openCreateKindDialog(opts) {
    opts = opts || {};
    var els = createKindEls();
    if (!els.root || !els.list) return;
    if (createKindWait) createKindWait("cancel");
    createKindCleanup();
    createKindPicked = "";
    mermaidOpen = false;
    noteRailPinned = "";
    noteRailLock = 0;
    if (els.filter) {
      els.filter.value = "";
      els.filter._sentryFilterCounted = false;
    }
    var done = false;
    function finish(action, kind) {
      if (done) return;
      done = true;
      createKindWait = null;
      createKindCleanup();
      if (action === "pick" && typeof sentryCount === "function") {
        if (kind === "welcome") sentryCount("create.welcome");
        else if (kind === "sketch") sentryCount("create.sketch");
        else if (kind === "boxes") sentryCount("create.boxes");
      }
      if (action === "pick" && typeof opts.onPick === "function") opts.onPick(kind);
      if (action === "cancel" && typeof opts.onCancel === "function") opts.onCancel();
    }
    createKindWait = finish;
    els.list._createKindPick = function (event) {
      var node = event && event.target;
      while (node && node !== els.list) {
        if (node.tagName === "SUMMARY" || (node.getAttribute && node.getAttribute("data-create-kind-group"))) return;
        var jump = node.getAttribute && node.getAttribute("data-create-kind-note-jump");
        if (jump) {
          jumpCreateKindNote(jump);
          return;
        }
        var kind = node.getAttribute && node.getAttribute("data-create-kind");
        if (kind) {
          if (node.disabled) return;
          finish("pick", kind);
          return;
        }
        node = node.parentNode;
      }
    };
    els.list._createKindToggle = function (event) {
      var t = event && event.target;
      if (!t || !t.getAttribute || t.getAttribute("data-create-kind-group") !== "Mermaid") return;
      mermaidOpen = !!t.open;
      if (typeof sentryCount === "function") sentryCount("create.mermaid_group");
      if (t.open) {
        var first = els.list.querySelector(".create-kind-note-block");
        pinCreateKindNote((first && first.getAttribute("data-create-kind-note")) || "", els.list);
      }
      syncCreateKindNoteRail();
    };
    els.list._createKindScroll = function () { clearCreateKindHover(els.list); };
    els.list._createKindPointer = function (event) {
      if (!event || (event.movementX === 0 && event.movementY === 0)) return;
      hoverCreateKindRow(els.list, createKindRowFromNode(event.target, els.list));
    };
    els.list._createKindPointerLeave = function () { clearCreateKindHover(els.list); };
    els.filter._createKindFilter = function () {
      if (els.filter && els.filter.value.trim() && !els.filter._sentryFilterCounted && typeof sentryCount === "function") {
        els.filter._sentryFilterCounted = true;
        sentryCount("create.filter");
      }
      paintCreateKindList();
    };
    els.backdrop._createKindCancel = function () { finish("cancel"); };
    els.list.addEventListener("click", els.list._createKindPick);
    els.list.addEventListener("toggle", els.list._createKindToggle, true);
    els.list.addEventListener("scroll", els.list._createKindScroll);
    els.list.addEventListener("pointermove", els.list._createKindPointer);
    els.list.addEventListener("pointerleave", els.list._createKindPointerLeave);
    if (els.filter) els.filter.addEventListener("input", els.filter._createKindFilter);
    if (els.backdrop) els.backdrop.addEventListener("click", els.backdrop._createKindCancel);
    document.addEventListener("keydown", createKindOnKey);
    els.root.hidden = false;
    paintCreateKindList();
    if (els.filter && typeof els.filter.focus === "function") els.filter.focus();
  }

  return {
    CREATE_KIND_ITEMS: CREATE_KIND_ITEMS,
    openCreateKindDialog: openCreateKindDialog,
    closeCreateKindDialog: closeCreateKindDialog,
  };
});
var openCreateKindDialog = globalThis.openCreateKindDialog;
var closeCreateKindDialog = globalThis.closeCreateKindDialog;
var CREATE_KIND_ITEMS = globalThis.CREATE_KIND_ITEMS;
