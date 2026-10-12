/* drawer-app/09-shell-drawer.js — the left drawer: open/close, account row, "Mine" group list, New board.
   The search pop-up here is still the LB-289 mock (real search is LB-294). */
var shellGroups = [];
var shellShares = [];

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
  var shareBtn = document.getElementById("shellShareBoard");
  if (shareBtn) shareBtn.addEventListener("click", function () {
    if (typeof cloudShareOpenBoard === "function") void cloudShareOpenBoard();
  });
  window.addEventListener("hashchange", function () { shellRenderMine(); shellRenderShared(); });
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
  shellRenderShared();
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

function shellIsPreview() {
  return typeof isLocalDrawerPreview === "function" && isLocalDrawerPreview() && !(cloudSession && cloudSession.user);
}

// "Share this board" works for a saved cloud board you own.
function shellSyncShareButton() {
  var btn = document.getElementById("shellShareBoard");
  if (!btn) return;
  var signedIn = !!(typeof cloudSession !== "undefined" && cloudSession && cloudSession.user);
  var own = typeof cloudBoardId === "function" && !!cloudBoardId() && !(typeof isShareGuest === "function" && isShareGuest());
  btn.disabled = !(signedIn && own) && !shellIsPreview();
  btn.title = btn.disabled ? "Save this board to the cloud to share it" : "Copy a link to this board";
}

var SHELL_ARROW_IN = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.5 4.5 4.5 11.5M4.5 6.5v5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var SHELL_ARROW_OUT = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 11.5l7-7M6.5 4.5h5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Local preview only: sample rows, including the "shared with me" kind that is not built yet.
function shellSampleShares() {
  return [
    { incoming: true, title: "Search ranking v2", note: "from Chen Yu · can view" },
    { incoming: true, title: "Release checklist", note: "from Mia · can edit" },
    { boardId: "x1", shareId: "x1", title: "LLM architecture", role: "view", isCurrent: true },
    { boardId: "x2", shareId: "x2", title: "Android MVI", role: "edit", isCurrent: false },
  ];
}

function shellShareAction(label, title, handler) {
  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  if (title) btn.title = title;
  btn.addEventListener("click", function (event) { event.stopPropagation(); handler(); });
  return btn;
}

// shares: cloudShareSummaries() result; omit to repaint the last one (the open board may have changed).
function shellRenderShared(shares) {
  var section = document.getElementById("shellShared");
  var list = document.getElementById("shellSharedList");
  var count = document.getElementById("shellSharedCount");
  if (!section || !list) return;
  if (shares) shellShares = shares;
  var preview = shellIsPreview();
  var signedIn = !!(cloudSession && cloudSession.user);
  section.hidden = !(signedIn || preview);
  shellSyncShareButton();
  var current = typeof cloudBoardId === "function" ? cloudBoardId() : "";
  var rows = preview ? shellSampleShares() : shellShares;
  var frag = document.createDocumentFragment();
  rows.forEach(function (item) {
    var li = document.createElement("li");
    if (item.incoming) {
      li.className = "shell-row shell-row-dir";
      li.innerHTML = '<i class="shell-dir is-in" title="Shared with you">' + SHELL_ARROW_IN + '</i>';
      var inMain = document.createElement("span");
      inMain.className = "shell-row-main";
      var inTitle = document.createElement("b");
      inTitle.textContent = item.title;
      var inNote = document.createElement("span");
      inNote.textContent = item.note;
      inMain.appendChild(inTitle);
      inMain.appendChild(inNote);
      li.appendChild(inMain);
      frag.appendChild(li);
      return;
    }
    var isCurrent = preview ? item.isCurrent : !!current && item.boardId === current;
    li.className = "shell-row shell-row-dir shell-row-link" + (isCurrent ? " is-active is-current" : "");
    var icon = document.createElement("i");
    icon.className = "shell-dir is-out";
    icon.title = "You shared this";
    icon.innerHTML = SHELL_ARROW_OUT;
    var main = document.createElement("div");
    main.className = "shell-row-main";
    var title = document.createElement("b");
    title.textContent = item.title || "Untitled";
    var note = document.createElement("span");
    note.textContent = "anyone with the link · " + item.role;
    main.appendChild(title);
    main.appendChild(note);
    li.appendChild(icon);
    li.appendChild(main);
    if (isCurrent) {
      var here = document.createElement("em");
      here.className = "shell-here";
      here.textContent = "Current";
      li.appendChild(here);
    }
    var acts = document.createElement("div");
    acts.className = "shell-row-acts";
    var live = !preview && typeof cloudShareMutate === "function";
    acts.appendChild(shellShareAction("Copy", "Copy the link", function () { if (live) void cloudShareCopyLink(item.shareId); }));
    acts.appendChild(shellShareAction(item.role === "edit" ? "Edit" : "View", item.role === "edit" ? "Anyone with the link can edit. Click to make it view only." : "Anyone with the link can view. Click to allow editing.", function () {
      if (live) void cloudShareMutate(item.boardId, "set_share_role", { p_role: item.role === "edit" ? "view" : "edit" }, item.role === "edit" ? "Link is view only" : "Link can edit");
    }));
    acts.appendChild(shellShareAction("New link", "Replace the link; the old one stops working", function () {
      if (live) void cloudShareMutate(item.boardId, "rotate_share", null, "Share link replaced");
    }));
    var stop = shellShareAction("Stop", "Stop sharing this board", async function () {
      if (!live) return;
      if (typeof boardAskConfirm === "function" && !(await boardAskConfirm({
        title: "Stop sharing this board?",
        copy: "Anyone with the link will lose access.",
        ok: "Stop sharing",
        cancel: "Cancel",
      }))) return;
      void cloudShareMutate(item.boardId, "unshare", null, "Stopped sharing");
    });
    stop.className = "is-danger";
    acts.appendChild(stop);
    li.appendChild(acts);
    li.addEventListener("click", function () {
      if (!live || isCurrent) return;
      if (typeof window.shellCloseDrawer === "function") window.shellCloseDrawer();
      if (typeof cloudSwitchToBoard === "function") void cloudSwitchToBoard(item.boardId);
    });
    frag.appendChild(li);
  });
  if (!rows.length) {
    var none = document.createElement("li");
    none.className = "shell-empty";
    none.textContent = "Nothing shared yet";
    frag.appendChild(none);
  }
  list.replaceChildren(frag);
  if (count) count.textContent = rows.length ? String(rows.length) : "";
}
