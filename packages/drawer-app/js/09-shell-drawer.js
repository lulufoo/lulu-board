/* drawer-app/09-shell-drawer.js — the left drawer: open/close, account row, "Mine" group list, New board.
   The search pop-up here is still the LB-289 mock (real search is LB-294). */
var shellGroups = [];

(function wireShellDrawer() {
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
    if (on) {
      drawer.focus({ preventScroll: true });
    }
  }
  function setSearch(on) {
    pop.hidden = !on;
    scrim.hidden = !(on || !drawer.hidden);
    if (on) { setDrawer(false); scrim.hidden = false; if (input) { input.focus(); input.select(); } }
  }
  function closeAll(restoreFocus) {
    var wasOpen = !drawer.hidden || !pop.hidden;
    setDrawer(false);
    setSearch(false);
    if (wasOpen && restoreFocus) toggle.focus({ preventScroll: true });
  }
  window.shellCloseDrawer = function () { closeAll(false); };

  toggle.addEventListener("click", function () { setSearch(false); setDrawer(drawer.hidden); });
  toggle.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle.click(); }
  });
  open.addEventListener("click", function () { setSearch(true); });
  scrim.addEventListener("click", function () { closeAll(false); });
  // Static rows (the mock Shared list) still highlight on click until LB-293 wires them.
  drawer.addEventListener("click", function (event) {
    var row = event.target.closest && event.target.closest("#shellShared .shell-row:not(.shell-row-link)");
    if (!row) return;
    drawer.querySelectorAll("#shellShared .shell-row.is-active:not(.is-current)").forEach(function (el) { el.classList.remove("is-active"); });
    row.classList.add("is-active");
  });
  // Shared list is folded by default; the header toggles it.
  var shared = document.getElementById("shellShared");
  var fold = document.getElementById("shellFold");
  if (shared && fold) {
    var openShared = /[?&]shared=open/.test(location.search);
    shared.classList.toggle("is-folded", !openShared);
    fold.setAttribute("aria-expanded", openShared ? "true" : "false");
    fold.addEventListener("click", function () {
      var folded = shared.classList.toggle("is-folded");
      fold.setAttribute("aria-expanded", folded ? "false" : "true");
    });
  }
  // Review links: ?shell=drawer or ?shell=search opens that state on load.
  // ?shell=props|style|source|export opens that right-dock panel.
  var want = /[?&]shell=(drawer|search|props|style|source|export)/.exec(location.search);
  if (want) {
    if (want[1] === "drawer") setDrawer(true);
    else if (want[1] === "search") setSearch(true);
    else { var tab = document.getElementById("btnDock" + want[1].charAt(0).toUpperCase() + want[1].slice(1)); if (tab) tab.click(); }
  }
  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setSearch(pop.hidden);
    } else if (event.key === "Escape" && (!drawer.hidden || !pop.hidden)) {
      closeAll(true);
    }
  });

  var signOut = document.getElementById("btnShellSignOut");
  if (signOut) signOut.addEventListener("click", function () {
    closeAll(false);
    if (typeof cloudSignOut === "function") void cloudSignOut();
  });
  var newBoard = document.getElementById("shellNewBoard");
  if (newBoard) newBoard.addEventListener("click", function () { void shellNewBlankBoard(); });
  window.addEventListener("hashchange", function () { shellRenderMine(); });
})();

// Account row. profile: { name, email, initials } or null when signed out.
function shellPaintAccount(profile) {
  var name = document.getElementById("shellAccountName");
  var email = document.getElementById("shellAccountEmail");
  var avatar = document.getElementById("shellAccountAvatar");
  var out = document.getElementById("btnShellSignOut");
  if (name) name.textContent = profile ? profile.name : "Not signed in";
  if (email) email.textContent = profile && profile.email && profile.email !== profile.name ? profile.email : "";
  if (avatar) avatar.textContent = profile ? profile.initials : "?";
  if (out) out.hidden = !profile;
}

function shellWhen(iso) {
  var date = new Date(String(iso || ""));
  if (Number.isNaN(date.getTime())) return "";
  var now = new Date();
  var startOf = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  var days = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Local preview has no cloud: show sample groups so the drawer can be reviewed.
function shellSampleGroups() {
  var now = new Date();
  var ago = function (d) { return new Date(now.getTime() - d * 86400000).toISOString(); };
  return [
    { groupId: "s1", title: "LLM architecture", boardCount: 3, updatedAt: ago(0), boardIds: ["s1"], faceBoardId: "", isCurrent: true },
    { groupId: "s2", title: "Android MVI", boardCount: 2, updatedAt: ago(1), boardIds: ["s2"], faceBoardId: "", isCurrent: false },
    { groupId: "s3", title: "Onboarding", boardCount: 1, updatedAt: ago(3), boardIds: ["s3"], faceBoardId: "", isCurrent: false },
    { groupId: "s4", title: "Payments retry flow", boardCount: 4, updatedAt: ago(9), boardIds: ["s4"], faceBoardId: "", isCurrent: false },
    { groupId: "s5", title: "Q3 planning", boardCount: 2, updatedAt: ago(14), boardIds: ["s5"], faceBoardId: "", isCurrent: false },
  ];
}

// groups: cloudGroupSummaries() result; omit to repaint the last one (the open board may have changed).
function shellRenderMine(groups) {
  var list = document.getElementById("shellMineList");
  var count = document.getElementById("shellMineCount");
  var empty = document.getElementById("shellMineEmpty");
  if (!list) return;
  if (groups) shellGroups = groups;
  var current = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  var preview = typeof isLocalDrawerPreview === "function" && isLocalDrawerPreview() && !(cloudSession && cloudSession.user);
  var rows = preview ? shellSampleGroups() : shellGroups;
  var frag = document.createDocumentFragment();
  rows.forEach(function (group) {
    var isCurrent = preview ? group.isCurrent : !!current && group.boardIds.indexOf(current) >= 0;
    var li = document.createElement("li");
    li.className = "shell-mine-item";
    var row = document.createElement("button");
    row.type = "button";
    row.className = "shell-row" + (isCurrent ? " is-active" : "");
    if (isCurrent) row.setAttribute("aria-current", "true");
    var title = document.createElement("b");
    title.textContent = group.title || "Untitled";
    var meta = document.createElement("span");
    var when = shellWhen(group.updatedAt);
    meta.textContent = group.boardCount + (group.boardCount === 1 ? " board" : " boards") + (when ? " · " + when : "");
    row.appendChild(title);
    row.appendChild(meta);
    row.addEventListener("click", function () {
      if (typeof window.shellCloseDrawer === "function") window.shellCloseDrawer();
      if (preview || isCurrent || !group.faceBoardId) return;
      if (typeof cloudSwitchToBoard === "function") void cloudSwitchToBoard(group.faceBoardId);
    });
    var del = document.createElement("button");
    del.type = "button";
    del.className = "shell-mine-del";
    del.setAttribute("aria-label", "Delete group " + (group.title || "Untitled"));
    del.title = "Delete group";
    del.textContent = "×";
    del.addEventListener("click", function (event) {
      event.stopPropagation();
      if (preview || typeof deleteCloudGroup !== "function") return;
      void deleteCloudGroup(group.groupId, group.boardIds);
    });
    li.appendChild(row);
    li.appendChild(del);
    frag.appendChild(li);
  });
  list.replaceChildren(frag);
  if (count) count.textContent = rows.length ? rows.length + (rows.length === 1 ? " group" : " groups") : "";
  if (empty) empty.hidden = rows.length > 0;
  // Until LB-293 wires Shared, only the local preview shows the mock list.
  var shared = document.getElementById("shellShared");
  if (shared) shared.hidden = !preview;
}

// New board: a blank, unsaved board. The first save creates its group.
async function shellNewBlankBoard() {
  if (typeof window.shellCloseDrawer === "function") window.shellCloseDrawer();
  if (typeof isLocalDrawerPreview === "function" && isLocalDrawerPreview() && !(cloudSession && cloudSession.user)) return;
  if (typeof cloudConfirmLeaveBoard === "function" && !(await cloudConfirmLeaveBoard())) return;
  if (typeof boardDirty !== "undefined" && boardDirty && typeof cloudBoardId === "function" && cloudBoardId() && typeof cloudParkDirtyBoard === "function") {
    cloudParkDirtyBoard();
  }
  if (typeof cloudClearDirtyLeave === "function") cloudClearDirtyLeave();
  history.replaceState(null, "", location.pathname + location.search);
  if (typeof cloudClearGroupTabs === "function") cloudClearGroupTabs();
  if (typeof bootstrapBoardFromHash === "function") await bootstrapBoardFromHash();
  if (typeof renderBoard === "function") renderBoard({ fit: false, restoreView: true });
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
  shellRenderMine();
}
