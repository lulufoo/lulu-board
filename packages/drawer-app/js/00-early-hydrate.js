/* Hydrate dock open state; Source rail label stays fixed "Source". */
(function () {
  try {
    var ui = JSON.parse(localStorage.getItem("drawer.ui") || "null") || {};
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
    if (dock && (dockTab === "source" || dockTab === "props" || dockTab === "export" || dockTab === "style" || dockTab === "share" || dockTab === "layout")) {
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
