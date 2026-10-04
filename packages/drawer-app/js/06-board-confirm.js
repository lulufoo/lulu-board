/* drawer-app/06-board-confirm.js — one in-app confirm for tabs and history */
var boardConfirmWait = null;

function boardConfirmCleanup() {
  var root = document.getElementById("boardConfirmDialog");
  var ok = document.getElementById("btnBoardConfirmOk");
  var cancel = document.getElementById("btnBoardConfirmCancel");
  var backdrop = document.getElementById("boardConfirmBackdrop");
  if (root) root.hidden = true;
  if (ok && ok._boardConfirmOk) ok.removeEventListener("click", ok._boardConfirmOk);
  if (cancel && cancel._boardConfirmCancel) cancel.removeEventListener("click", cancel._boardConfirmCancel);
  if (backdrop && backdrop._boardConfirmCancel) backdrop.removeEventListener("click", backdrop._boardConfirmCancel);
  document.removeEventListener("keydown", boardConfirmOnKey);
  if (ok) ok._boardConfirmOk = null;
  if (cancel) cancel._boardConfirmCancel = null;
  if (backdrop) backdrop._boardConfirmCancel = null;
}

function boardConfirmOnKey(event) {
  if (!event) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (boardConfirmWait) boardConfirmWait(false);
  }
}

function boardAskConfirm(opts) {
  opts = opts || {};
  var root = document.getElementById("boardConfirmDialog");
  var title = document.getElementById("boardConfirmTitle");
  var copy = document.getElementById("boardConfirmCopy");
  var ok = document.getElementById("btnBoardConfirmOk");
  var cancel = document.getElementById("btnBoardConfirmCancel");
  var backdrop = document.getElementById("boardConfirmBackdrop");
  if (!root || !title || !copy || !ok || !cancel) return Promise.resolve(false);
  if (boardConfirmWait) boardConfirmWait(false);
  boardConfirmCleanup();
  title.textContent = opts.title || "Not saved yet";
  copy.textContent = opts.copy || "Switch anyway?";
  ok.textContent = opts.ok || "Confirm";
  cancel.textContent = opts.cancel || "Cancel";
  return new Promise(function (resolve) {
    var done = false;
    function finish(value) {
      if (done) return;
      done = true;
      boardConfirmWait = null;
      boardConfirmCleanup();
      resolve(!!value);
    }
    boardConfirmWait = finish;
    ok._boardConfirmOk = function () { finish(true); };
    cancel._boardConfirmCancel = function () { finish(false); };
    backdrop._boardConfirmCancel = cancel._boardConfirmCancel;
    ok.addEventListener("click", ok._boardConfirmOk);
    cancel.addEventListener("click", cancel._boardConfirmCancel);
    if (backdrop) backdrop.addEventListener("click", backdrop._boardConfirmCancel);
    document.addEventListener("keydown", boardConfirmOnKey);
    root.hidden = false;
    if (typeof ok.focus === "function") ok.focus();
  });
}
