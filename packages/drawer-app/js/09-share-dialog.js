/* drawer-app/09-share-dialog.js — the Share dialog: link, who can do what, a new link.
   One dialog serves "Share this board" and every row in Shared. Stopping a share stays on the row. */

var shareDialogItem = null;
var shareDialogBusy = false;

function shareDialogEl(id) { return document.getElementById(id); }

function shareDialogLive() {
  return !shellIsPreview() && typeof cloudShareMutate === "function";
}

function shareDialogRandomId() {
  var out = "s_";
  while (out.length < 34) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function shareDialogFind(boardId) {
  var shares = typeof shellShares !== "undefined" ? shellShares : [];
  return shares.filter(function (item) { return item.boardId === boardId; })[0] || null;
}

// The board open now: its share row if it has one, otherwise a not-yet-shared stand-in.
function shareDialogCurrentItem(wantNew) {
  if (shellIsPreview()) {
    var sample = shellSampleShares().filter(function (item) { return item.isCurrent; })[0];
    var copy = Object.assign({ boardId: "x0", title: "Untitled", shareId: "", role: "view", isCurrent: true }, sample);
    if (wantNew) copy.shareId = "";
    return copy;
  }
  var boardId = cloudBoardId();
  var known = shareDialogFind(boardId);
  if (known) return known;
  var source = typeof boardSourceEl !== "undefined" && boardSourceEl ? boardSourceEl.value : "";
  return { boardId: boardId, title: cloudBoardTitle(source) || "Untitled", shareId: "", role: "view", isCurrent: true };
}

function shareDialogLink(shareId) {
  return cloudShareLinkFor(shareId) || (location.origin + "/#s:" + shareId);
}

function shareDialogRoleHint(role) {
  return role === "edit"
    ? "Signed-in people with the link can edit this board."
    : "Anyone with the link can view this board.";
}

function shareDialogPaint() {
  var item = shareDialogItem;
  if (!item) return;
  var shared = !!item.shareId;
  shareDialogEl("shareDialogBoard").textContent = item.title || "Untitled";
  shareDialogEl("shareDialogOff").hidden = shared;
  shareDialogEl("shareDialogOn").hidden = !shared;
  shareDialogEl("shareOpenBoard").hidden = !!item.isCurrent;
  if (!shared) return;
  shareDialogEl("shareLinkInput").value = shareDialogLink(item.shareId);
  shareDialogEl("shareRoleHint").textContent = shareDialogRoleHint(item.role);
  Array.prototype.forEach.call(document.querySelectorAll("[data-share-role]"), function (btn) {
    btn.setAttribute("aria-checked", btn.getAttribute("data-share-role") === item.role ? "true" : "false");
  });
}

function shareDialogOpen(item) {
  var dialog = shareDialogEl("shareDialog");
  if (!dialog || !item) return;
  shareDialogItem = Object.assign({}, item);
  shareDialogPaint();
  dialog.hidden = false;
  var first = shareDialogEl(shareDialogItem.shareId ? "shareCopy" : "shareCreate");
  if (first) first.focus({ preventScroll: true });
}

function shareDialogClose() {
  var dialog = shareDialogEl("shareDialog");
  if (dialog) dialog.hidden = true;
  shareDialogItem = null;
}

// Run one change. Live: the cloud call, then the refreshed list is the truth. Preview: change the sample copy.
async function shareDialogApply(rpc, args, okStatus, preview) {
  var item = shareDialogItem;
  if (!item || shareDialogBusy) return;
  if (!shareDialogLive()) {
    Object.assign(item, preview(item));
    shareDialogPaint();
    return;
  }
  shareDialogBusy = true;
  try {
    await cloudShareMutate(item.boardId, rpc, args, okStatus);
    var fresh = shareDialogFind(item.boardId);
    if (shareDialogItem) {
      shareDialogItem = fresh ? Object.assign({}, fresh, { isCurrent: item.isCurrent }) : Object.assign({}, item, { shareId: "" });
      shareDialogPaint();
    }
  } finally {
    shareDialogBusy = false;
  }
}

function shareDialogCreateLink() {
  void shareDialogApply("open_share", null, "Share link ready", function () { return { shareId: shareDialogRandomId(), role: "view" }; });
}

function shareDialogSetRole(role) {
  var item = shareDialogItem;
  if (!item || !item.shareId || item.role === role) return;
  void shareDialogApply("set_share_role", { p_role: role }, role === "edit" ? "Link can edit" : "Link is view only", function () { return { role: role }; });
}

function shareDialogRenewLink() {
  void shareDialogApply("rotate_share", null, "Share link replaced", function () { return { shareId: shareDialogRandomId() }; });
}

async function shareDialogCopyLink() {
  var item = shareDialogItem;
  var btn = shareDialogEl("shareCopy");
  if (!item || !item.shareId || !btn) return;
  if (shareDialogLive()) await cloudShareCopyLink(item.shareId);
  btn.textContent = "Copied";
  setTimeout(function () { btn.textContent = "Copy"; }, 1400);
}

function shareDialogOpenBoard() {
  var item = shareDialogItem;
  shareDialogClose();
  if (!item || item.isCurrent || !shareDialogLive()) return;
  if (typeof window.shellCloseDrawer === "function") window.shellCloseDrawer();
  if (typeof cloudSwitchToBoard === "function") void cloudSwitchToBoard(item.boardId);
}

// "Share this board" in the Shared tab. wantNew: review links only, shows the not-yet-shared state.
function shareDialogOpenCurrent(wantNew) {
  shareDialogOpen(shareDialogCurrentItem(wantNew));
}

(function wireShareDialog() {
  var dialog = shareDialogEl("shareDialog");
  if (!dialog) return;
  shareDialogEl("shareDialogBackdrop").addEventListener("click", shareDialogClose);
  shareDialogEl("shareDone").addEventListener("click", shareDialogClose);
  shareDialogEl("shareCreate").addEventListener("click", shareDialogCreateLink);
  shareDialogEl("shareCopy").addEventListener("click", function () { void shareDialogCopyLink(); });
  shareDialogEl("shareNewLink").addEventListener("click", shareDialogRenewLink);
  shareDialogEl("shareOpenBoard").addEventListener("click", shareDialogOpenBoard);
  shareDialogEl("shareLinkInput").addEventListener("focus", function (event) { event.target.select(); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-share-role]"), function (btn) {
    btn.addEventListener("click", function () { shareDialogSetRole(btn.getAttribute("data-share-role")); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || dialog.hidden) return;
    event.stopPropagation();
    shareDialogClose();
  }, true);
  // Review links: ?share=open shows the dialog for the open board, ?share=new its not-yet-shared state.
  var want = /[?&]share=(open|new)/.exec(location.search);
  if (want) shareDialogOpenCurrent(want[1] === "new");
})();
