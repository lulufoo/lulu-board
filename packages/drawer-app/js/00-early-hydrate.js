/* hydrate toolbar / panels before late bootstrap */
(function () {
  var board = document.documentElement.dataset.drawerMode === 'board';
  var panelM = document.getElementById('panelMermaid');
  if (panelM) panelM.classList.toggle('active', !board);
})();

/* Hydrate toolbar before late bootstrap (no wrong tab / Type / tools flash). */
(function () {
  var mode = document.documentElement.dataset.drawerMode || "mermaid";
  var tabM = document.getElementById("tabMermaid");
  var tabB = document.getElementById("tabBoard");
  if (tabM) tabM.setAttribute("aria-selected", String(mode !== "board"));
  if (tabB) tabB.setAttribute("aria-selected", String(mode === "board"));
  try {
    var ui = JSON.parse(localStorage.getItem("drawer.ui") || "null") || {};
    var pill = document.getElementById("typePill");
    var dt = ui.diagramType;
    if (pill && dt) {
      pill.innerHTML = "<b>" + String(dt).replace(/[<>&]/g, "") + "</b>";
    }
    if (mode === "mermaid") {
      var low = dt ? String(dt).toLowerCase() : "";
      var mindmap = low === "mindmap";
      var stateDiag = low === "statediagram" || low === "statediagram-v2";
      var flowchart = (!low || low === "flowchart" || low === "graph") && !mindmap && !stateDiag;
      // Prefer Type keyword; mindmap must set mindmap=1 so Delete is present before module boot.
      document.documentElement.dataset.mermaidFlowchart = flowchart ? "1" : "0";
      document.documentElement.dataset.mermaidMindmap = mindmap ? "1" : "0";
      document.documentElement.dataset.mermaidState = stateDiag ? "1" : "0";
    }
  } catch (e) {}
})();

/* Hydrate dock open state; Source rail label stays fixed "Source". */
(function () {
  try {
    var ui = JSON.parse(localStorage.getItem("drawer.ui") || "null") || {};
    var mode = document.documentElement.dataset.drawerMode || "mermaid";
    var tabEl = document.getElementById("sourceDockTabLabel");
    var btn = document.getElementById("btnDockSource");
    if (tabEl) tabEl.textContent = "Source";
    if (btn) btn.title = "Source";
    var dock = document.getElementById("boardDock");
    var dockW = Number(ui.dockWidth);
    if (dock && isFinite(dockW) && dockW > 0) {
      dock.style.setProperty("--dock-open-width", Math.min(720, Math.max(280, Math.round(dockW))) + "px");
    }
    var dockTab = ui.dockTab || "";
    if (dock && (dockTab === "source" || dockTab === "props" || dockTab === "export" || dockTab === "style" || (dockTab === "layout" && mode === "board"))) {
      dock.setAttribute("data-open", dockTab);
      Array.prototype.forEach.call(dock.querySelectorAll("[data-dock]"), function (b) {
        var on = b.getAttribute("data-dock") === dockTab;
        b.setAttribute("aria-selected", on ? "true" : "false");
        if (on) b.classList.add("is-active");
        else b.classList.remove("is-active");
      });
    }
  } catch (e) {}
})();
