/* In-app confirm for tabs and history. */
import { register } from '../core/hooks.js';

/* drawer-app/06-confirm.js — one in-app confirm for tabs and history */
var confirmWait = null;

function confirmCleanup() {
  var root = document.getElementById("confirmDialog");
  var ok = document.getElementById("btnConfirmOk");
  var cancel = document.getElementById("btnConfirmCancel");
  var backdrop = document.getElementById("confirmBackdrop");
  if (root) root.hidden = true;
  if (ok && ok._confirmOk) ok.removeEventListener("click", ok._confirmOk);
  if (cancel && cancel._confirmCancel) cancel.removeEventListener("click", cancel._confirmCancel);
  if (backdrop && backdrop._confirmCancel) backdrop.removeEventListener("click", backdrop._confirmCancel);
  document.removeEventListener("keydown", confirmOnKey);
  if (ok) ok._confirmOk = null;
  if (cancel) cancel._confirmCancel = null;
  if (backdrop) backdrop._confirmCancel = null;
}

function confirmOnKey(event) {
  if (!event) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (confirmWait) confirmWait(false);
  }
}

function askConfirm(opts) {
  opts = opts || {};
  var root = document.getElementById("confirmDialog");
  var title = document.getElementById("confirmTitle");
  var copy = document.getElementById("confirmCopy");
  var ok = document.getElementById("btnConfirmOk");
  var cancel = document.getElementById("btnConfirmCancel");
  var backdrop = document.getElementById("confirmBackdrop");
  if (!root || !title || !copy || !ok || !cancel) return Promise.resolve(false);
  if (confirmWait) confirmWait(false);
  confirmCleanup();
  title.textContent = opts.title || "Not saved yet";
  copy.textContent = opts.copy || "Switch anyway?";
  ok.textContent = opts.ok || "Confirm";
  cancel.textContent = opts.cancel || "Cancel";
  return new Promise(function (resolve) {
    var done = false;
    function finish(value) {
      if (done) return;
      done = true;
      confirmWait = null;
      confirmCleanup();
      resolve(!!value);
    }
    confirmWait = finish;
    ok._confirmOk = function () { finish(true); };
    cancel._confirmCancel = function () { finish(false); };
    backdrop._confirmCancel = cancel._confirmCancel;
    ok.addEventListener("click", ok._confirmOk);
    cancel.addEventListener("click", cancel._confirmCancel);
    if (backdrop) backdrop.addEventListener("click", backdrop._confirmCancel);
    document.addEventListener("keydown", confirmOnKey);
    root.hidden = false;
    if (typeof ok.focus === "function") ok.focus();
  });
}


register("confirmCleanup", confirmCleanup);
register("confirmOnKey", confirmOnKey);
register("askConfirm", askConfirm);
export {
  confirmCleanup,
  confirmOnKey,
  askConfirm
};
