/* Properties AI / You panes. Tab choice is session-only and not persisted. */

function propsYouHasFields() {
  var maxW = document.getElementById("board-max-width-field");
  var font = document.getElementById("boardNodeFontField");
  return !!(maxW && !maxW.hidden) || !!(font && !font.hidden);
}

function setPropsPane(name) {
  var root = document.getElementById("propsFields");
  var bar = document.getElementById("props-panes");
  if (!root) return;
  var youOn = propsYouHasFields();
  var want = name === "you" && youOn ? "you" : "ai";
  root.setAttribute("data-props-pane", want);
  if (bar) bar.hidden = !youOn;
  ["ai", "you"].forEach(function (pane) {
    var tab = document.getElementById("props-pane-" + pane);
    if (!tab) return;
    var on = pane === want;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
    if (pane === "you") tab.hidden = !youOn;
  });
}

function syncPropsPanes() {
  var root = document.getElementById("propsFields");
  var current = root ? root.getAttribute("data-props-pane") : "ai";
  setPropsPane(current === "you" ? "you" : "ai");
}

(function wirePropsPanes() {
  var bar = document.getElementById("props-panes");
  var root = document.getElementById("propsFields");
  if (!bar || !root) return;
  bar.addEventListener("click", function (event) {
    var tab = event.target.closest ? event.target.closest(".props-tab") : null;
    if (!tab) return;
    setPropsPane(tab.getAttribute("data-props-pane"));
  });
  bar.addEventListener("keydown", function (event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!propsYouHasFields()) return;
    event.preventDefault();
    var next = root.getAttribute("data-props-pane") === "ai" ? "you" : "ai";
    setPropsPane(next);
    var tab = document.getElementById("props-pane-" + next);
    if (tab) tab.focus({ preventScroll: true });
  });
})();

export { propsYouHasFields, setPropsPane, syncPropsPanes };
