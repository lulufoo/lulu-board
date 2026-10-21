/* drawer-app/09-create-kind-dialog.js — pick Board vs Mermaid (flowchart). Does not write hash or source. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.openCreateKindDialog = api.openCreateKindDialog;
  root.closeCreateKindDialog = api.closeCreateKindDialog;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var createKindWait = null;

  function createKindEls() {
    return {
      root: document.getElementById("createKindDialog"),
      board: document.getElementById("btnCreateKindBoard"),
      mermaid: document.getElementById("btnCreateKindMermaid"),
      backdrop: document.getElementById("createKindBackdrop"),
    };
  }

  function createKindCleanup() {
    var els = createKindEls();
    if (els.root) els.root.hidden = true;
    if (els.board && els.board._createKindPick) els.board.removeEventListener("click", els.board._createKindPick);
    if (els.mermaid && els.mermaid._createKindPick) els.mermaid.removeEventListener("click", els.mermaid._createKindPick);
    if (els.backdrop && els.backdrop._createKindCancel) els.backdrop.removeEventListener("click", els.backdrop._createKindCancel);
    document.removeEventListener("keydown", createKindOnKey);
    if (els.board) els.board._createKindPick = null;
    if (els.mermaid) els.mermaid._createKindPick = null;
    if (els.backdrop) els.backdrop._createKindCancel = null;
  }

  function createKindOnKey(event) {
    if (!event || event.key !== "Escape") return;
    event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    if (createKindWait) createKindWait("cancel");
  }

  function closeCreateKindDialog() {
    if (createKindWait) createKindWait("cancel");
    else createKindCleanup();
  }

  function openCreateKindDialog(opts) {
    opts = opts || {};
    var els = createKindEls();
    if (!els.root || !els.board || !els.mermaid) return;
    if (createKindWait) createKindWait("cancel");
    createKindCleanup();
    var done = false;
    function finish(action, kind) {
      if (done) return;
      done = true;
      createKindWait = null;
      createKindCleanup();
      if (action === "pick" && typeof opts.onPick === "function") opts.onPick(kind);
      if (action === "cancel" && typeof opts.onCancel === "function") opts.onCancel();
    }
    createKindWait = finish;
    els.board._createKindPick = function () { finish("pick", "board"); };
    els.mermaid._createKindPick = function () { finish("pick", "flowchart"); };
    els.backdrop._createKindCancel = function () { finish("cancel"); };
    els.board.addEventListener("click", els.board._createKindPick);
    els.mermaid.addEventListener("click", els.mermaid._createKindPick);
    if (els.backdrop) els.backdrop.addEventListener("click", els.backdrop._createKindCancel);
    document.addEventListener("keydown", createKindOnKey);
    els.root.hidden = false;
    if (els.board && typeof els.board.focus === "function") els.board.focus();
  }

  return {
    openCreateKindDialog: openCreateKindDialog,
    closeCreateKindDialog: closeCreateKindDialog,
  };
});
var openCreateKindDialog = globalThis.openCreateKindDialog;
var closeCreateKindDialog = globalThis.closeCreateKindDialog;
