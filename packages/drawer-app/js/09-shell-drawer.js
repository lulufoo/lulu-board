/* drawer-app/09-shell-drawer.js — the left drawer: open/close, account row, "Mine" group list, "Shared" list, New board.
   The Mine / Shared tabs live in 09-shell-tabs.js.
   Search: ⌘K pop-up, name search over groups and boards plus lines of the open board. */
// Declared early in 01-shell-state.js, because 06-* runs top-level code that reads them before this file is reached.
// `x = x || []` keeps whatever was already stored, and still defines them when this file is loaded on its own.
var shellGroups = shellGroups || [];
var shellShares = shellShares || [];

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
      shellRevealCurrent();
    }
  }
  function setSearch(on) {
    pop.hidden = !on;
    scrim.hidden = !(on || !drawer.hidden);
    if (on) { setDrawer(false); scrim.hidden = false; if (input) { input.focus(); input.select(); } shellRenderSearch(); }
  }
  function closeAll(restoreFocus) {
    if (typeof window.shellCloseAuthMenu === "function") window.shellCloseAuthMenu();
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
  window.shellCloseSearch = function () { setSearch(false); };
  if (input) {
    input.addEventListener("input", function () { shellRenderSearch(); });
    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") { event.preventDefault(); shellMoveSearch(1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); shellMoveSearch(-1); }
      else if (event.key === "Enter") { event.preventDefault(); shellPickSearch(); }
    });
  }
  scrim.addEventListener("click", function () { closeAll(false); });
  // Review links: ?shell=drawer or ?shell=search opens that state on load.
  // ?shell=props|style|source|export opens that right-dock panel.
  var want = /[?&]shell=(drawer|search|props|style|source|export)/.exec(location.search);
  if (want) {
    if (want[1] === "drawer") setDrawer(true);
    else if (want[1] === "search") setSearch(true);
    else { var tab = document.getElementById("btnDock" + want[1].charAt(0).toUpperCase() + want[1].slice(1)); if (tab) tab.click(); }
  }
  // Blank start: early-head sets data-blank-start-drawer for every blank-start (LB-360).
  if (document.documentElement.dataset.blankStartDrawer === "1") {
    setDrawer(true);
    delete document.documentElement.dataset.blankStartDrawer;
  }
  if (typeof shellOfferBlankStartKind === "function") shellOfferBlankStartKind();
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
  // Signed out: the account row is the sign-in entry. It opens a small menu to pick Google or GitHub
  // (the provider buttons carry data-shell-oauth, so 06-cloud-sync starts the flow). Signed in: the row is inert.
  var account = document.getElementById("btnShellAccount");
  var authMenu = document.getElementById("shellAuthMenu");
  function setAuthMenu(on) {
    if (!authMenu) return;
    authMenu.hidden = !on;
    if (account) account.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) { var first = authMenu.querySelector("button"); if (first) first.focus({ preventScroll: true }); }
  }
  window.shellCloseAuthMenu = function () { setAuthMenu(false); };
  if (account) account.addEventListener("click", function (event) {
    if (!account.classList.contains("is-signin")) return;
    event.stopPropagation();
    setAuthMenu(!!authMenu && authMenu.hidden);
  });
  if (authMenu) {
    authMenu.addEventListener("click", function () { setAuthMenu(false); closeAll(false); });
    document.addEventListener("click", function (event) {
      if (!authMenu.hidden && !authMenu.contains(event.target)) setAuthMenu(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !authMenu.hidden) { event.stopPropagation(); setAuthMenu(false); account.focus({ preventScroll: true }); }
    }, true);
  }
  var newBoard = document.getElementById("shellNewDiagram");
  if (newBoard) newBoard.addEventListener("click", function () { void shellNewBlankDiagram(); });
  var shareBtn = document.getElementById("shellShareDiagram");
  if (shareBtn) shareBtn.addEventListener("click", function () {
    if (typeof shareDialogOpenCurrent === "function") shareDialogOpenCurrent(false);
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
  var row = document.getElementById("btnShellAccount");
  if (row) {
    row.classList.toggle("is-signin", !profile);
    if (profile && typeof window.shellCloseAuthMenu === "function") window.shellCloseAuthMenu();
    row.title = profile ? "" : "Sign in";
    row.setAttribute("aria-label", profile ? (profile.name || "Account") : "Not signed in. Choose how to sign in");
  }
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
    { groupId: "s1", title: "LLM architecture", diagramCount: 3, updatedAt: ago(0), diagramIds: ["s1"], faceDiagramId: "", isCurrent: true },
    { groupId: "s2", title: "Android MVI", diagramCount: 2, updatedAt: ago(1), diagramIds: ["s2"], faceDiagramId: "", isCurrent: false },
    { groupId: "s3", title: "Onboarding", diagramCount: 1, updatedAt: ago(3), diagramIds: ["s3"], faceDiagramId: "", isCurrent: false },
    { groupId: "s4", title: "Payments retry flow", diagramCount: 4, updatedAt: ago(9), diagramIds: ["s4"], faceDiagramId: "", isCurrent: false },
    { groupId: "s5", title: "Q3 planning", diagramCount: 2, updatedAt: ago(14), diagramIds: ["s5"], faceDiagramId: "", isCurrent: false },
  ].concat(Array.from({ length: 19 }, function (_, i) {
    var titles = ["Roadmap", "Retro notes", "Search ranking", "Billing", "Design review", "Infra costs", "Hiring loop"];
    return { groupId: "s" + (i + 6), title: titles[i % titles.length] + (i >= titles.length ? " " + (Math.floor(i / titles.length) + 1) : ""), diagramCount: 1 + (i % 3), updatedAt: ago(16 + i * 3), diagramIds: ["s" + (i + 6)], faceDiagramId: "", isCurrent: false };
  }));
}

// groups: cloudGroupSummaries() result; omit to repaint the last one (the open board may have changed).
// Mine shows a page of groups; Load more adds the next page. The open group is always listed.
// A function, not a var: the first render can run before this file's var initialisers do.
function shellMinePage() { return 20; }
var shellMineShown = 0; // 0 = first page

// Pure: which rows to list, and how many are held back.
function shellMineWindow(rows, shown, isCurrent) {
  var visible = rows.filter(function (group, index) { return index < shown || isCurrent(group); });
  return { visible: visible, hidden: rows.length - visible.length };
}

// Scroll the Mine list (not the page) so the open group is fully visible.
function shellRevealCurrent() {
  var list = document.getElementById("shellMineList");
  var row = list && list.querySelector(".shell-row.is-active");
  if (!row) return;
  var over = row.parentNode.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom;
  if (over > 0) list.scrollTop += over + 6;
}

// Mine pages in by itself: when the last row scrolls into view it shows "Loading more" with cycling dots,
// then adds the next page. The data is already in memory; the short pause only makes the state visible.
function shellMineLoadDelay() { return 900; }
var shellMineWatcher = null;
var shellMineLoading = false;

function shellWatchMore(list, sentinel) {
  if (shellMineWatcher) shellMineWatcher.disconnect();
  shellMineWatcher = null;
  if (!sentinel || typeof IntersectionObserver !== "function") return;
  shellMineWatcher = new IntersectionObserver(function (entries) {
    if (shellMineLoading || !entries.some(function (entry) { return entry.isIntersecting; })) return;
    shellMineLoading = true;
    sentinel.classList.add("is-loading");
    sentinel.appendChild(document.createTextNode("Loading more"));
    var dots = document.createElement("span");
    dots.className = "shell-dots";
    dots.setAttribute("aria-hidden", "true");
    dots.innerHTML = "<i>.</i><i>.</i><i>.</i>";
    sentinel.appendChild(dots);
    setTimeout(function () {
      shellMineLoading = false;
      shellMineShown = (shellMineShown || shellMinePage()) + shellMinePage();
      shellRenderMine();
    }, shellMineLoadDelay());
  }, { root: list, threshold: 0.6 });
  shellMineWatcher.observe(sentinel);
}

function shellRenderMine(groups) {
  var list = document.getElementById("shellMineList");
  var count = document.getElementById("shellMineCount");
  var empty = document.getElementById("shellMineEmpty");
  if (!list) return;
  if (groups) shellGroups = groups;
  var current = typeof cloudDiagramId === "function" ? cloudDiagramId() : "";
  var preview = typeof isLocalDrawerPreview === "function" && isLocalDrawerPreview() && !(cloudSession && cloudSession.user);
  var rows = preview ? shellSampleGroups() : shellGroups;
  var frag = document.createDocumentFragment();
  function inCurrent(group) { return preview ? !!group.isCurrent : !!current && group.diagramIds.indexOf(current) >= 0; }
  var win = shellMineWindow(rows, shellMineShown || shellMinePage(), inCurrent);
  win.visible.forEach(function (group) {
    var isCurrent = inCurrent(group);
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
    meta.textContent = group.diagramCount + " diagrams" + (when ? " · " + when : "");
    row.appendChild(title);
    row.appendChild(meta);
    row.addEventListener("click", function () {
      if (typeof window.shellCloseDrawer === "function") window.shellCloseDrawer();
      if (preview || isCurrent || !group.faceDiagramId) return;
      if (typeof cloudSwitchToDiagram === "function") void cloudSwitchToDiagram(group.faceDiagramId);
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
      void deleteCloudGroup(group.groupId, group.diagramIds);
    });
    li.appendChild(row);
    li.appendChild(del);
    frag.appendChild(li);
  });
  var sentinel = null;
  if (win.hidden > 0) {
    // Last row of the scrolling list. Not a button: reaching it loads the next page.
    sentinel = document.createElement("li");
    sentinel.className = "shell-more-item";
    sentinel.id = "shellMineMore";
    sentinel.setAttribute("role", "status");
    frag.appendChild(sentinel);
  }
  var keepScroll = list.scrollTop;
  list.replaceChildren(frag);
  list.scrollTop = keepScroll;
  shellWatchMore(list, sentinel);
  if (count) count.textContent = rows.length ? String(rows.length) : "";
  if (empty) empty.hidden = rows.length > 0;
  shellRenderShared();
}

// New board: pick Board vs Mermaid first. The first save creates its group.
async function shellNewBlankDiagram() {
  if (typeof window.shellCloseDrawer === "function") window.shellCloseDrawer();
  if (typeof isLocalDrawerPreview === "function" && isLocalDrawerPreview() && !(cloudSession && cloudSession.user)) return;
  if (typeof cloudConfirmLeaveDiagram === "function" && !(await cloudConfirmLeaveDiagram())) return;
  if (typeof openCreateKindDialog !== "function") return;
  openCreateKindDialog({
    onPick: function (kind) { applyCreateKindPick(kind, function (picked) { void shellCommitBlankDiagram(picked); }); },
    onCancel: function () {},
  });
}

function shellCloseAfterKindPick() {
  if (typeof window.shellCloseDrawer === "function") window.shellCloseDrawer();
}

async function shellCommitBlankDiagram(kind) {
  shellCloseAfterKindPick();
  if (typeof diagramDirty !== "undefined" && diagramDirty && typeof cloudDiagramId === "function" && cloudDiagramId() && typeof cloudParkDirtyDiagram === "function") {
    cloudParkDirtyDiagram();
  }
  if (typeof cloudClearDirtyLeave === "function") cloudClearDirtyLeave();
  history.replaceState(null, "", location.pathname + location.search);
  if (typeof cloudClearGroupTabs === "function") cloudClearGroupTabs();
  var source;
  try {
    if (typeof loadKindTemplateSource !== "function") throw new Error("Template is unavailable");
    source = await loadKindTemplateSource(kind);
  } catch (err) {
    if (typeof setStatus === "function") setStatus(err instanceof Error ? err.message : String(err), true);
    return;
  }
  if (typeof setShareView === "function") setShareView(false);
  if (typeof setShareEdit === "function") setShareEdit(false);
  if (typeof diagramSourceEl !== "undefined" && diagramSourceEl) {
    diagramSourceEl.value = source;
    delete diagramSourceEl.dataset.boardSelectionKey;
    delete diagramSourceEl.dataset.boardEdgeSelectionKey;
  }
  diagramLocalRev = 1;
  diagramServerRev = 0;
  if (typeof applyDiagramLiveMeta === "function") {
    applyDiagramLiveMeta({ id: "", version: 1 });
  }
  if (typeof saveDiagramToHash === "function") await saveDiagramToHash({ bump: false });
  if (typeof renderDiagram === "function") renderDiagram({ fit: false, restoreView: true });
  if (typeof syncCloudSaveChrome === "function") syncCloudSaveChrome();
  if (typeof nudgeUncreatedCreateTip === "function") nudgeUncreatedCreateTip();
  shellRenderMine();
}

var shellKindPromptOpen = false;

function shellOfferBlankStartKind() {
  if (typeof DrawerEarlyHead === "undefined" || typeof openCreateKindDialog !== "function") return;
  if (shellKindPromptOpen) return;
  var ctx = {
    pathname: location.pathname,
    hash: location.hash,
    search: location.search,
    storage: DrawerEarlyHead.safeStorage(typeof globalThis !== "undefined" ? globalThis : this),
  };
  if (DrawerEarlyHead.isLegalHash(ctx.hash)) return;
  var flagged = typeof document !== "undefined" && document.documentElement && document.documentElement.dataset.blankStartKind === "1";
  if (!flagged && !DrawerEarlyHead.shouldBlankStart(ctx) && !(DrawerEarlyHead.isAuthReturn && DrawerEarlyHead.isAuthReturn(ctx.search))) {
    return;
  }
  shellKindPromptOpen = true;
  function open() {
    openCreateKindDialog({
      onPick: function (kind) {
        shellKindPromptOpen = false;
        if (typeof document !== "undefined" && document.documentElement) {
          delete document.documentElement.dataset.blankStartKind;
        }
        applyCreateKindPick(kind, function (picked) { void shellCommitBlankDiagram(picked); });
      },
      onCancel: function () { open(); },
    });
  }
  open();
}
window.shellOfferBlankStartKind = shellOfferBlankStartKind;

function shellIsPreview() {
  return typeof isLocalDrawerPreview === "function" && isLocalDrawerPreview() && !(cloudSession && cloudSession.user);
}

// Is the open board already one of the shares? (Then its row, not this button, is how you reach its dialog.)
function shellOpenDiagramShared() {
  if (shellIsPreview()) return shellSampleShares().some(function (item) { return item.isCurrent; });
  var current = typeof cloudDiagramId === "function" ? cloudDiagramId() : "";
  return !!current && shellShares.some(function (item) { return item.diagramId === current; });
}

// "Share this board" works for a saved cloud board you own, and only shows while the open board is not shared yet.
function shellSyncShareButton() {
  var btn = document.getElementById("shellShareDiagram");
  var row = document.getElementById("shellShareRow");
  if (!btn) return;
  if (row) row.hidden = shellOpenDiagramShared();
  var signedIn = !!(typeof cloudSession !== "undefined" && cloudSession && cloudSession.user);
  var own = typeof cloudDiagramId === "function" && !!cloudDiagramId() && !(typeof isShareGuest === "function" && isShareGuest());
  btn.disabled = !(signedIn && own) && !shellIsPreview();
  btn.title = btn.disabled ? "Save this diagram to the cloud to share it" : "Share this diagram";
}

// Functions, not vars: the first render can run before this file's var initialisers do.
function shellArrowIn() { return '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.5 4.5 4.5 11.5M4.5 6.5v5h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
function shellArrowOut() { return '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 11.5l7-7M6.5 4.5h5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }

// Local preview only: sample rows, including the "shared with me" kind that is not built yet.
function shellSampleShares() {
  var openIsShared = !/[?&]board=unshared/.test(location.search); // review link: ?board=unshared
  return [
    { incoming: true, title: "Search ranking v2", note: "from Chen Yu · can view" },
    { incoming: true, title: "Release checklist", note: "from Mia · can edit" },
    { diagramId: "x1", shareId: "s_11111111111111111111111111111111", title: "LLM architecture", role: "view", isCurrent: openIsShared },
    { diagramId: "x2", shareId: "s_22222222222222222222222222222222", title: "Android MVI", role: "edit", isCurrent: false },
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
  shellSyncTabs(!section.hidden);
  shellSyncShareButton();
  var current = typeof cloudDiagramId === "function" ? cloudDiagramId() : "";
  var rows = preview ? shellSampleShares() : shellShares;
  var frag = document.createDocumentFragment();
  rows.forEach(function (item) {
    var li = document.createElement("li");
    if (item.incoming) {
      li.className = "shell-row shell-row-dir";
      li.innerHTML = '<i class="shell-dir is-in" title="Shared with you">' + shellArrowIn() + '</i>';
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
    var isCurrent = preview ? item.isCurrent : !!current && item.diagramId === current;
    li.className = "shell-row shell-row-dir shell-row-link" + (isCurrent ? " is-active is-current" : "");
    var icon = document.createElement("i");
    icon.className = "shell-dir is-out";
    icon.title = "You shared this";
    icon.innerHTML = shellArrowOut();
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
    // Everything else about a share (link, who can do what, a new link) lives in the Share dialog.
    var stop = shellShareAction("Stop", "Stop sharing this diagram", async function () {
      if (!live) return;
      if (typeof askConfirm === "function" && !(await askConfirm({
        title: "Stop sharing this diagram?",
        copy: "Anyone with the link will lose access.",
        ok: "Stop sharing",
        cancel: "Cancel",
      }))) return;
      void cloudShareMutate(item.diagramId, "unshare", null, "Stopped sharing");
    });
    stop.className = "is-danger";
    acts.appendChild(stop);
    li.appendChild(acts);
    li.tabIndex = 0;
    li.title = "Share settings";
    function openShare() { if (typeof shareDialogOpen === "function") shareDialogOpen(Object.assign({}, item, { isCurrent: isCurrent })); }
    li.addEventListener("click", openShare);
    li.addEventListener("keydown", function (event) {
      if (event.target === li && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openShare(); }
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

// ---- search ----
var shellSearchHits = [];
var shellSearchIndex = 0;
var shellSearchSeq = 0;

// Case-insensitive substring search. groups: cloudGroupSummaries() shape (members carry board titles).
// Empty query: the most recently edited groups. Lines: matching lines of the open board's source.
function shellSearchMatches(query, groups, source) {
  var q = String(query || "").trim().toLowerCase();
  var boards = [];
  (groups || []).forEach(function (group) {
    var members = group.members && group.members.length ? group.members : [{ graph_id: group.faceDiagramId, title: group.title }];
    if (!q) {
      boards.push({ groupId: group.groupId, title: group.title, note: group.diagramCount + " diagrams", diagramId: group.faceDiagramId });
      return;
    }
    var groupHit = String(group.title || "").toLowerCase().indexOf(q) >= 0;
    var boardHit = members.filter(function (m) { return String(m.title || "").toLowerCase().indexOf(q) >= 0; })[0];
    if (!groupHit && !boardHit) return;
    var viaBoard = !groupHit && boardHit;
    boards.push({
      groupId: group.groupId,
      title: group.title,
      note: viaBoard ? "Diagram · " + boardHit.title : group.diagramCount + " diagrams",
      diagramId: viaBoard ? boardHit.graph_id : group.faceDiagramId,
    });
  });
  var lines = [];
  if (q) {
    String(source || "").split("\n").forEach(function (text, index) {
      if (lines.length >= 6) return;
      if (text.toLowerCase().indexOf(q) >= 0) lines.push({ line: index, text: text.trim() });
    });
  }
  return { boards: boards.slice(0, q ? 20 : 5), lines: lines };
}

function shellSearchGroups() {
  if (shellIsPreview()) {
    return shellSampleGroups().map(function (g) {
      return { groupId: g.groupId, title: g.title, diagramCount: g.diagramCount, faceDiagramId: "", members: [{ graph_id: "", title: g.title }] };
    });
  }
  return shellGroups;
}

function shellPaintSearchResults(query, found, remote) {
  var box = document.getElementById("shellSearchResults");
  if (!box) return;
  shellSearchHits = [];
  var frag = document.createDocumentFragment();
  function section(label, items, kind) {
    if (!items.length) return;
    var p = document.createElement("p");
    p.className = "shell-search-label";
    p.textContent = label;
    frag.appendChild(p);
    items.forEach(function (item) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "shell-row";
      row.setAttribute("role", "option");
      var title = document.createElement("b");
      var note = document.createElement("span");
      if (kind === "line") { title.textContent = item.text; note.textContent = "line " + (item.line + 1) + " of this diagram"; }
      else { title.textContent = item.title || "Untitled"; note.textContent = item.note; }
      row.appendChild(title);
      row.appendChild(note);
      var hit = { kind: kind, item: item, el: row };
      row.addEventListener("click", function () { shellSearchIndex = shellSearchHits.indexOf(hit); shellPickSearch(); });
      shellSearchHits.push(hit);
      frag.appendChild(row);
    });
  }
  section(String(query).trim() ? "Vela" : "Recent", found.boards, "board");
  section("Mine", (remote && remote.mine) || [], "mine");
  section("Public", (remote && remote.public) || [], "public");
  section("In this diagram", found.lines, "line");
  if (!shellSearchHits.length) {
    var none = document.createElement("p");
    none.className = "shell-empty";
    none.textContent = "No match";
    frag.appendChild(none);
  }
  box.replaceChildren(frag);
  shellSearchIndex = 0;
  shellPaintSearchActive();
}

function shellRenderSearch() { void shellFillSearch(); }

async function shellFillSearch() {
  var box = document.getElementById("shellSearchResults");
  var input = document.getElementById("shellSearchInput");
  if (!box || !input) return;
  var seq = ++shellSearchSeq;
  var query = input.value;
  var source = typeof diagramSourceEl !== "undefined" && diagramSourceEl ? diagramSourceEl.value : "";
  var found = shellSearchMatches(query, shellSearchGroups(), source);
  var remote = { mine: [], public: [] };
  shellPaintSearchResults(query, found, remote);
  var q = String(query || "").trim();
  if (!q || typeof cloudSearchDiagrams !== "function" || typeof cloudSearchSignedIn !== "function" || !cloudSearchSignedIn()) return;
  try {
    remote = await cloudSearchDiagrams(q);
  } catch (error) {
    if (seq !== shellSearchSeq) return;
    if (typeof setStatus === "function") setStatus(error && error.message ? error.message : "Search failed", true);
    return;
  }
  if (seq !== shellSearchSeq) return;
  shellPaintSearchResults(query, found, remote);
}

function shellPaintSearchActive() {
  shellSearchHits.forEach(function (hit, index) {
    hit.el.classList.toggle("is-picked", index === shellSearchIndex);
    if (index === shellSearchIndex && hit.el.scrollIntoView) hit.el.scrollIntoView({ block: "nearest" });
  });
}

function shellMoveSearch(step) {
  if (!shellSearchHits.length) return;
  shellSearchIndex = (shellSearchIndex + step + shellSearchHits.length) % shellSearchHits.length;
  shellPaintSearchActive();
}

function shellPickSearch() {
  var hit = shellSearchHits[shellSearchIndex];
  if (!hit) return;
  if (typeof window.shellCloseSearch === "function") window.shellCloseSearch();
  if (shellIsPreview()) return;
  if (hit.kind === "board" || hit.kind === "mine") {
    if (hit.item.diagramId && typeof cloudSwitchToDiagram === "function") void cloudSwitchToDiagram(hit.item.diagramId);
    return;
  }
  if (hit.kind === "public") {
    if (hit.item.shareId && typeof cloudShareHash === "function") location.hash = cloudShareHash(hit.item.shareId);
    return;
  }
  // A line of the open board: show it in Source and select it.
  if (typeof openDock === "function") openDock("source");
  if (typeof diagramSourceEl === "undefined" || !diagramSourceEl) return;
  var lines = diagramSourceEl.value.split("\n");
  var start = 0;
  for (var i = 0; i < hit.item.line; i++) start += lines[i].length + 1;
  diagramSourceEl.focus();
  diagramSourceEl.setSelectionRange(start, start + lines[hit.item.line].length);
}
