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
    { cls: "Board", name: "Board", note: "Structured whiteboard", ready: true, kind: "board" },
    { cls: "Mermaid", name: "Flowchart", note: "flow", ready: true, kind: "flowchart" },
    { cls: "Mermaid", name: "Block", note: "flow", ready: false, kind: "block-beta" },
    { cls: "Mermaid", name: "Mindmap", note: "flow", ready: false, kind: "mindmap" },
    { cls: "Mermaid", name: "Architecture", note: "flow", ready: false, kind: "architecture" },
    { cls: "Mermaid", name: "Swimlane", note: "flow", ready: false, kind: "swimlane-beta" },
    { cls: "Mermaid", name: "Agentflow", note: "flow", ready: false, kind: "agentflow-beta" },
    { cls: "Mermaid", name: "Tree View", note: "flow", ready: false, kind: "treeView-beta" },
    { cls: "Mermaid", name: "Sequence", note: "design", ready: false, kind: "sequenceDiagram" },
    { cls: "Mermaid", name: "Class", note: "design", ready: false, kind: "classDiagram" },
    { cls: "Mermaid", name: "State", note: "design", ready: false, kind: "stateDiagram" },
    { cls: "Mermaid", name: "ER", note: "design", ready: false, kind: "erDiagram" },
    { cls: "Mermaid", name: "Requirement", note: "design", ready: false, kind: "requirement" },
    { cls: "Mermaid", name: "C4", note: "design", ready: false, kind: "C4Context" },
    { cls: "Mermaid", name: "Use Case", note: "design", ready: false, kind: "usecase-beta" },
    { cls: "Mermaid", name: "Event Modeling", note: "design", ready: false, kind: "eventmodeling" },
    { cls: "Mermaid", name: "Railroad", note: "design", ready: false, kind: "railroad-beta" },
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

  var createKindWait = null;
  var createKindPicked = "";

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

  function paintCreateKindList() {
    var els = createKindEls();
    if (!els.list) return;
    var q = createKindQuery();
    var html = "";
    var last = "";
    var n = 0;
    CREATE_KIND_ITEMS.forEach(function (it) {
      var hay = (it.cls + " " + it.name + " " + it.note).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      if (it.cls !== last) {
        html += "<div class=\"create-kind-label\">" + it.cls + "</div>";
        last = it.cls;
      }
      var picked = it.kind === createKindPicked;
      var cls = "create-kind-row" + (picked ? " is-picked" : "");
      html += "<button type=\"button\" class=\"" + cls + "\" data-create-kind=\"" + it.kind + "\""
        + (it.ready ? "" : " disabled") + ">"
        + "<span class=\"create-kind-main\"><b>" + it.name + "</b><span>" + it.note + "</span></span>"
        + "</button>";
      n += 1;
    });
    els.list.innerHTML = n ? html : "<div class=\"create-kind-empty\">No types match</div>";
  }

  function createKindCleanup() {
    var els = createKindEls();
    if (els.root) els.root.hidden = true;
    if (els.list && els.list._createKindPick) els.list.removeEventListener("click", els.list._createKindPick);
    if (els.filter && els.filter._createKindFilter) els.filter.removeEventListener("input", els.filter._createKindFilter);
    if (els.backdrop && els.backdrop._createKindCancel) els.backdrop.removeEventListener("click", els.backdrop._createKindCancel);
    document.removeEventListener("keydown", createKindOnKey);
    if (els.list) els.list._createKindPick = null;
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
    if (els.filter) els.filter.value = "";
    var done = false;
    function finish(action, kind) {
      if (done) return;
      done = true;
      createKindWait = null;
      createKindCleanup();
      if (action === "pick" && typeof opts.onPick === "function") opts.onPick(kind);
      if (action === "cancel" && typeof opts.onCancel === "function") opts.onCancel();
    }
    createKindWait = finish;
    els.list._createKindPick = function (event) {
      var node = event && event.target;
      while (node && node !== els.list) {
        var kind = node.getAttribute && node.getAttribute("data-create-kind");
        if (kind) {
          if (node.disabled) return;
          finish("pick", kind);
          return;
        }
        node = node.parentNode;
      }
    };
    els.filter._createKindFilter = function () { paintCreateKindList(); };
    els.backdrop._createKindCancel = function () { finish("cancel"); };
    els.list.addEventListener("click", els.list._createKindPick);
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
