/* Share dialog: link, role, public listing. */
import { register, call, emit } from '../core/hooks.js';
import { cloudDiagramId } from '../cloud/cloud-state.js';
import { getDiagramTitle, cloudOpenDiagramId } from '../cloud/cloud-sync.js';
import { cloudShareMutate, cloudShareCopyLink, cloudShareLinkFor } from '../cloud/cloud-shares.js';
import { shellShares } from '../state/shell-state.js';
import { cloudSwitchToDiagram } from '../cloud/cloud-group-tabs.js';

/* drawer-app/09-share-dialog.js — the Share dialog: link, who can do what, a new link.
   One dialog serves "Share this board" and every row in Shared. Stopping a share stays on the row. */

var shareDialogItem = null;
var shareDialogBusy = false;

function shareDialogEl(id) { return document.getElementById(id); }

function shareDialogLive() {
  return !call("shellIsPreview") && typeof cloudShareMutate === "function";
}

function shareDialogRandomId() {
  var out = "s_";
  while (out.length < 34) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function shareDialogFind(diagramId) {
  var shares = typeof shellShares !== "undefined" ? shellShares : [];
  return shares.filter(function (item) { return item.diagramId === diagramId; })[0] || null;
}

// The board open now: its share row if it has one, otherwise a not-yet-shared stand-in.
function shareDialogCurrentItem(wantNew) {
  if (call("shellIsPreview")) {
    var sample = call("shellSampleShares").filter(function (item) { return item.isCurrent; })[0];
    var copy = Object.assign({ diagramId: "x0", title: "Untitled", shareId: "", role: "view", isPublic: false, isCurrent: true }, sample);
    if (wantNew) copy.shareId = "";
    return copy;
  }
  var diagramId = cloudDiagramId();
  var known = shareDialogFind(diagramId);
  if (known) return known;
  return { diagramId: diagramId, title: getDiagramTitle(cloudOpenDiagramId()), shareId: "", role: "view", isPublic: false, isCurrent: true };
}

function shareDialogLink(shareId) {
  return cloudShareLinkFor(shareId) || (location.origin + "/#s:" + shareId);
}

function shareDialogRoleHint(role) {
  return role === "edit"
    ? "Signed-in people with the link can edit this diagram."
    : "Anyone with the link can view this diagram.";
}

function shareDialogPublicHint(item) {
  if (item.role === "edit") return "Turn link access to View before listing this diagram in search.";
  return item.isPublic
    ? "Signed-in people can find this diagram in search."
    : "Off. This Vela is not listed in search.";
}

function shareDialogPaint() {
  var item = shareDialogItem;
  if (!item) return;
  var shared = !!item.shareId;
  var isPublic = !!item.isPublic;
  shareDialogEl("shareDialogDiagram").textContent = item.title || "Untitled";
  shareDialogEl("shareDialogOff").hidden = shared;
  shareDialogEl("shareDialogOn").hidden = !shared;
  shareDialogEl("shareOpenDiagram").hidden = !!item.isCurrent;
  if (!shared) return;
  shareDialogEl("shareLinkInput").value = shareDialogLink(item.shareId);
  shareDialogEl("shareRoleHint").textContent = shareDialogRoleHint(item.role);
  Array.prototype.forEach.call(document.querySelectorAll("[data-share-role]"), function (btn) {
    var role = btn.getAttribute("data-share-role");
    btn.setAttribute("aria-checked", role === item.role ? "true" : "false");
    btn.disabled = role === "edit" && isPublic;
  });
  var pub = shareDialogEl("sharePublicToggle");
  var hint = shareDialogEl("sharePublicHint");
  if (pub) {
    pub.setAttribute("aria-checked", isPublic ? "true" : "false");
    pub.disabled = item.role === "edit";
  }
  if (hint) hint.textContent = shareDialogPublicHint(item);
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
    await cloudShareMutate(item.diagramId, rpc, args, okStatus);
    var fresh = shareDialogFind(item.diagramId);
    if (shareDialogItem) {
      shareDialogItem = fresh ? Object.assign({}, fresh, { isCurrent: item.isCurrent }) : Object.assign({}, item, { shareId: "" });
      shareDialogPaint();
    }
  } finally {
    shareDialogBusy = false;
  }
}

function shareDialogCreateLink() {
  void shareDialogApply("open_share", null, "Share link ready", function () { return { shareId: shareDialogRandomId(), role: "view", isPublic: false }; });
}

function shareDialogSetRole(role) {
  var item = shareDialogItem;
  if (!item || !item.shareId || item.role === role) return;
  if (role === "edit" && item.isPublic) return;
  void shareDialogApply("set_share_role", { p_role: role }, role === "edit" ? "Link can edit" : "Link is view only", function () { return { role: role }; });
}

function shareDialogSetPublic(on) {
  var item = shareDialogItem;
  if (!item || !item.shareId || !!item.isPublic === !!on) return;
  if (on && item.role === "edit") return;
  void shareDialogApply(
    "set_share_role",
    { p_role: on ? "view" : "off", p_principal: "public" },
    on ? "Listed in search" : "Removed from search",
    function () { return { isPublic: !!on }; }
  );
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

function shareDialogOpenDiagram() {
  var item = shareDialogItem;
  shareDialogClose();
  if (!item || item.isCurrent || !shareDialogLive()) return;
  emit("shellCloseDrawer");
  if (typeof cloudSwitchToDiagram === "function") void cloudSwitchToDiagram(item.diagramId);
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
  shareDialogEl("shareOpenDiagram").addEventListener("click", shareDialogOpenDiagram);
  shareDialogEl("shareLinkInput").addEventListener("focus", function (event) { event.target.select(); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-share-role]"), function (btn) {
    btn.addEventListener("click", function () { shareDialogSetRole(btn.getAttribute("data-share-role")); });
  });
  var pub = shareDialogEl("sharePublicToggle");
  if (pub) pub.addEventListener("click", function () {
    shareDialogSetPublic(pub.getAttribute("aria-checked") !== "true");
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


register("shareDialogEl", shareDialogEl);
register("shareDialogLive", shareDialogLive);
register("shareDialogRandomId", shareDialogRandomId);
register("shareDialogFind", shareDialogFind);
register("shareDialogCurrentItem", shareDialogCurrentItem);
register("shareDialogLink", shareDialogLink);
register("shareDialogRoleHint", shareDialogRoleHint);
register("shareDialogPublicHint", shareDialogPublicHint);
register("shareDialogPaint", shareDialogPaint);
register("shareDialogOpen", shareDialogOpen);
register("shareDialogClose", shareDialogClose);
register("shareDialogApply", shareDialogApply);
register("shareDialogCreateLink", shareDialogCreateLink);
register("shareDialogSetRole", shareDialogSetRole);
register("shareDialogSetPublic", shareDialogSetPublic);
register("shareDialogRenewLink", shareDialogRenewLink);
register("shareDialogCopyLink", shareDialogCopyLink);
register("shareDialogOpenDiagram", shareDialogOpenDiagram);
register("shareDialogOpenCurrent", shareDialogOpenCurrent);
export {
  shareDialogEl,
  shareDialogLive,
  shareDialogRandomId,
  shareDialogFind,
  shareDialogCurrentItem,
  shareDialogLink,
  shareDialogRoleHint,
  shareDialogPublicHint,
  shareDialogPaint,
  shareDialogOpen,
  shareDialogClose,
  shareDialogApply,
  shareDialogCreateLink,
  shareDialogSetRole,
  shareDialogSetPublic,
  shareDialogRenewLink,
  shareDialogCopyLink,
  shareDialogOpenDiagram,
  shareDialogOpenCurrent
};
