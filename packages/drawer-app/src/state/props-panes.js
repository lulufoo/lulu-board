/* Properties AI / You panes. Tab choice is session-only and not persisted.
 * preferred stays what the user clicked. Visible pane falls back to AI when
 * You has no fields, then returns to preferred when the fields come back. */
var preferred = "ai";

function propsYouHasFields() {
  var maxW = document.getElementById("board-max-width-field");
  var font = document.getElementById("boardNodeFontField");
  return !!(maxW && !maxW.hidden) || !!(font && !font.hidden);
}

function setPropsPane(name, fromUser) {
  var root = document.getElementById("propsFields");
  var bar = document.getElementById("props-panes");
  if (!root) return;
  if (fromUser && (name === "you" || name === "ai")) preferred = name;
  var youOn = propsYouHasFields();
  var want = preferred === "you" && youOn ? "you" : "ai";
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
  setPropsPane(preferred, false);
}

(function wirePropsPanes() {
  var bar = document.getElementById("props-panes");
  var root = document.getElementById("propsFields");
  if (!bar || !root) return;
  bar.addEventListener("click", function (event) {
    var tab = event.target.closest ? event.target.closest(".props-tab") : null;
    if (!tab) return;
    setPropsPane(tab.getAttribute("data-props-pane"), true);
  });
  bar.addEventListener("keydown", function (event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!propsYouHasFields()) return;
    event.preventDefault();
    var next = preferred === "ai" ? "you" : "ai";
    setPropsPane(next, true);
    var tab = document.getElementById("props-pane-" + next);
    if (tab) tab.focus({ preventScroll: true });
  });
})();

export { propsYouHasFields, setPropsPane, syncPropsPanes };
