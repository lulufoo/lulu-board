/* drawer-app/09-shell-tabs.js — the Mine / Shared tabs of the left drawer.
   The chosen tab lives on the drawer body (data-shell-tab), not in a variable: the drawer can render before this file's
   var initialisers run. Shared follows whether its section is shown (signed in, or local preview). */

function shellTabAvailable(name) {
  var tab = document.getElementById(name === "shared" ? "shellTabShared" : "shellTabMine");
  return !!tab && !tab.hidden;
}

function shellSelectTab(name) {
  var body = document.querySelector(".shell-drawer-body");
  if (!body) return;
  var want = name === "shared" && shellTabAvailable("shared") ? "shared" : "mine";
  body.setAttribute("data-shell-tab", want);
  document.querySelectorAll(".shell-tab").forEach(function (tab) {
    var on = tab.getAttribute("data-shell-tab") === want;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
  });
}

// Called by shellRenderShared. A ?shared=open request waits here until Shared is shown.
function shellSyncTabs(sharedShown) {
  var body = document.querySelector(".shell-drawer-body");
  var tab = document.getElementById("shellTabShared");
  if (!body || !tab) return;
  tab.hidden = !sharedShown;
  if (sharedShown && body.getAttribute("data-shell-want") === "shared") {
    body.removeAttribute("data-shell-want");
    shellSelectTab("shared");
  } else if (!sharedShown && body.getAttribute("data-shell-tab") === "shared") {
    shellSelectTab("mine");
  }
}

(function wireShellTabs() {
  var bar = document.getElementById("shellTabs");
  var body = document.querySelector(".shell-drawer-body");
  if (!bar || !body) return;
  bar.addEventListener("click", function (event) {
    var tab = event.target.closest ? event.target.closest(".shell-tab") : null;
    if (tab) {
      var name = tab.getAttribute("data-shell-tab");
      if (typeof sentryCount === "function") sentryCount(name === "shared" ? "home.tab_shared" : "home.tab_mine");
      shellSelectTab(name);
    }
  });
  bar.addEventListener("keydown", function (event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    var names = ["mine", "shared"].filter(shellTabAvailable);
    if (names.length < 2) return;
    event.preventDefault();
    var next = body.getAttribute("data-shell-tab") === "mine" ? "shared" : "mine";
    shellSelectTab(next);
    var tab = document.getElementById(next === "shared" ? "shellTabShared" : "shellTabMine");
    if (tab) tab.focus({ preventScroll: true });
  });
  if (/[?&]shared=open/.test(location.search)) {
    body.setAttribute("data-shell-want", "shared");
    // The drawer may have rendered before this wiring ran: if Shared is already shown, take the request now.
    if (shellTabAvailable("shared")) shellSyncTabs(true);
  }
})();
