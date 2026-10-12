/* drawer-app/09-shell-prototype.js — shell-align prototype: toggle the static drawer and search. No data wiring. */
(function wireShellPrototype() {
  var toggle = document.getElementById("shellDrawerToggle");
  var drawer = document.getElementById("shellDrawer");
  var scrim = document.getElementById("shellScrim");
  var pop = document.getElementById("shellSearchPop");
  var open = document.getElementById("shellSearchOpen");
  var input = document.getElementById("shellSearchInput");
  if (!toggle || !drawer || !scrim || !pop || !open) return;

  function setDrawer(on) {
    drawer.hidden = !on;
    toggle.setAttribute("aria-expanded", on ? "true" : "false");
    scrim.hidden = !(on || !pop.hidden);
  }
  function setSearch(on) {
    pop.hidden = !on;
    scrim.hidden = !(on || !drawer.hidden);
    if (on) { setDrawer(false); scrim.hidden = false; if (input) { input.focus(); input.select(); } }
  }

  toggle.addEventListener("click", function () { setSearch(false); setDrawer(drawer.hidden); });
  toggle.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle.click(); }
  });
  open.addEventListener("click", function () { setSearch(true); });
  scrim.addEventListener("click", function () { setDrawer(false); setSearch(false); });
  drawer.addEventListener("click", function (event) {
    var row = event.target.closest && event.target.closest(".shell-row:not(.shell-row-link)");
    if (!row) return;
    drawer.querySelectorAll(".shell-row.is-active").forEach(function (el) { el.classList.remove("is-active"); });
    row.classList.add("is-active");
  });
  // Shared section layout: default merged list; ?shared=fold or ?shared=tabs for the alternates.
  var layout = /[?&]shared=(fold|tabs)/.exec(location.search);
  if (layout) document.documentElement.setAttribute("data-shared", layout[1]);
  var shared = document.getElementById("shellShared");
  var fold = document.getElementById("shellFold");
  if (shared && fold) {
    if (layout && layout[1] === "fold") { shared.classList.add("is-folded"); fold.setAttribute("aria-expanded", "false"); }
    fold.addEventListener("click", function () {
      if (document.documentElement.getAttribute("data-shared") !== "fold") return;
      var folded = shared.classList.toggle("is-folded");
      fold.setAttribute("aria-expanded", folded ? "false" : "true");
    });
  }
  var seg = document.getElementById("shellSeg");
  if (/[?&]pane=shared/.test(location.search)) {
    drawer.setAttribute("data-pane", "shared");
    if (seg) seg.querySelectorAll("button").forEach(function (el) { el.classList.toggle("is-on", el.dataset.pane === "shared"); });
  }
  if (seg) seg.addEventListener("click", function (event) {
    var btn = event.target.closest && event.target.closest("button[data-pane]");
    if (!btn) return;
    seg.querySelectorAll("button").forEach(function (el) { el.classList.toggle("is-on", el === btn); });
    drawer.setAttribute("data-pane", btn.dataset.pane);
  });
  // Review links: ?shell=drawer or ?shell=search opens that state on load.
  // ?shell=style opens the right dock Style panel.
  var want = /[?&]shell=(drawer|search|style)/.exec(location.search);
  if (want) {
    if (want[1] === "drawer") setDrawer(true);
    else if (want[1] === "search") setSearch(true);
    else { var tab = document.getElementById("btnDockStyle"); if (tab) tab.click(); }
  }
  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setSearch(pop.hidden);
    } else if (event.key === "Escape" && (!drawer.hidden || !pop.hidden)) {
      setDrawer(false);
      setSearch(false);
    }
  });
})();
