/* drawer-app/03-mermaid-inspect.js — Mermaid-common select / open-Props gesture.
 * Shared by flowchart, mindmap, and future diagram kinds (e.g. state). Board stays separate.
 *
 * Rules:
 * 1) pointerdown captures `already` BEFORE select.
 * 2) First click → select only (do not open Props on that click's trailing events).
 * 3) Re-click same selected target → open Props.
 * 4) Props open + already showing that key → noop; open but other target → refresh fill.
 * 5) Pan (moved) cancels Props open.
 */
var mermaidInspectGesture = null;
var mermaidPropsShownKey = "";

var MermaidInspect = (function () {
  function getSelectionKey() {
    return selectedMermaid && selectedMermaid.key ? selectedMermaid.key : "";
  }

  function begin(key) {
    var k = key || "";
    mermaidInspectGesture = {
      key: k,
      already: !!(k && k === getSelectionKey()),
      moved: false,
    };
    return mermaidInspectGesture;
  }

  function markMoved() {
    if (mermaidInspectGesture) mermaidInspectGesture.moved = true;
  }

  function clearGesture() {
    mermaidInspectGesture = null;
  }

  /** Consume gesture: true iff re-press on same key without pan. */
  function consumeClick(key) {
    var gesture = mermaidInspectGesture;
    mermaidInspectGesture = null;
    return !!(gesture && !gesture.moved && gesture.already && gesture.key && gesture.key === key);
  }

  function clearPropsShown() {
    mermaidPropsShownKey = "";
  }

  /**
   * Open or refresh Props for key.
   * @param {string} key
   * @param {{ fill?: function, blocked?: boolean }} opts fill() loads fields; blocked skips (e.g. link mode)
   */
  function wantProps(key, opts) {
    opts = opts || {};
    if (!key || opts.blocked) return false;
    if (typeof currentDockTab === "function" && currentDockTab() === "props" && mermaidPropsShownKey === key) {
      return false;
    }
    if (typeof opts.fill === "function") opts.fill();
    if (typeof openPropsPanel === "function") openPropsPanel();
    mermaidPropsShownKey = key;
    return true;
  }

  /** Open Props for current selection (inspect). */
  function inspect(opts) {
    opts = opts || {};
    if (opts.blocked) return false;
    if (typeof opts.fill === "function") opts.fill();
    if (typeof openPropsPanel === "function") openPropsPanel();
    mermaidPropsShownKey = getSelectionKey() || "";
    return true;
  }

  return {
    begin: begin,
    markMoved: markMoved,
    clearGesture: clearGesture,
    consumeClick: consumeClick,
    wantProps: wantProps,
    inspect: inspect,
    clearPropsShown: clearPropsShown,
    getSelectionKey: getSelectionKey,
  };
})();
