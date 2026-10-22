/* drawer-app/09-shortcuts.js — the Keyboard shortcuts dialog. SHORTCUT_GROUPS is the one list;
   each row names the file and a snippet of its real binding (tests check the binding exists).
   Key tokens: "Mod" = ⌘ on Mac / Ctrl elsewhere, "Alt" = ⌥ / Alt. */
var SHORTCUT_GROUPS = [
  { title: "Workspace", rows: [
    { label: "Search diagrams", keys: [["Mod", "K"]], src: "09-shell-drawer.js", probe: 'event.key.toLowerCase() === "k"' },
    { label: "Toggle Source panel", keys: [["Mod", "\\"]], src: "07-chrome-boot.js", probe: "e.key === '\\\\'" },
    { label: "Re-render diagram", keys: [["Mod", "Enter"]], src: "07-chrome-boot.js", probe: "e.key === 'Enter'" },
    { label: "Keyboard shortcuts", keys: [["?"]], src: "09-shortcuts.js", probe: 'event.key === "?"' },
    { label: "Close dialog or panel", keys: [["Esc"]], src: "09-shell-drawer.js", probe: 'event.key === "Escape"' }
  ] },
  { title: "Canvas", rows: [
    { label: "Zoom in / out", keys: [["Scroll"]], src: "07-chrome-boot.js", probe: "addEventListener('wheel'" }
  ] },
  { title: "Selection", rows: [
    { label: "Delete selected", keys: [["Delete"], ["Backspace"]], src: "02-board.js", probe: 'event.key !== "Backspace"' },
    { label: "Select previous / next sibling", keys: [["↑"], ["↓"]], src: "02-board.js", probe: "boardNudgeSelection(delta)" },
    { label: "Nudge top-level box", keys: [["←"], ["→"], ["↑"], ["↓"]], src: "02-board.js", probe: "boardNudgeTopLevel(dx, dy)" },
    { label: "Reorder among siblings", keys: [["Alt", "↑"], ["Alt", "↓"]], src: "02-board.js", probe: "!event.altKey" },
    { label: "Select whole box", keys: [["Mod", "Click"]], src: "02-board.js", probe: "function boardWantsTreeSelect" }
  ] },
  { title: "Text", rows: [
    { label: "Save title or ID", keys: [["Enter"]], src: "07-chrome-boot.js", probe: 'if (event.key !== "Enter") return;' },
    { label: "Save multi-line title", keys: [["Mod", "Enter"]], src: "07-chrome-boot.js", probe: 'is-multiline") && !event.metaKey' }
  ] }
];

function shortcutIsMac() {
  var nav = typeof navigator !== "undefined" ? navigator : {};
  var plat = (nav.userAgentData && nav.userAgentData.platform) || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad/i.test(plat);
}

function shortcutKeyLabel(token, mac) {
  if (token === "Mod") return mac ? "⌘" : "Ctrl";
  if (token === "Alt") return mac ? "⌥" : "Alt";
  if (token === "Enter") return mac ? "↩" : "Enter";
  return token;
}

function shortcutIsTyping(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || "");
}

if (typeof module === "object" && module.exports) {
  module.exports = { SHORTCUT_GROUPS: SHORTCUT_GROUPS, shortcutKeyLabel: shortcutKeyLabel, shortcutIsTyping: shortcutIsTyping };
}

(function wireShortcutsDialog() {
  if (typeof document === "undefined") return;
  var dialog = document.getElementById("shortcutsDialog");
  var grid = document.getElementById("shortcutsGrid");
  if (!dialog || !grid) return;
  var backFocus = null;

  function render() {
    var mac = shortcutIsMac();
    grid.textContent = "";
    SHORTCUT_GROUPS.forEach(function (group) {
      var sec = document.createElement("section");
      sec.className = "shortcuts-group";
      var h = document.createElement("h3");
      h.textContent = group.title;
      sec.appendChild(h);
      var list = document.createElement("dl");
      group.rows.forEach(function (row) {
        var line = document.createElement("div");
        line.className = "shortcuts-row";
        var dt = document.createElement("dt");
        dt.textContent = row.label;
        var dd = document.createElement("dd");
        row.keys.forEach(function (combo) {
          var chip = document.createElement("kbd");
          chip.className = "shortcuts-key";
          chip.textContent = combo.map(function (t) { return shortcutKeyLabel(t, mac); }).join(mac ? " " : " + ");
          dd.appendChild(chip);
        });
        line.appendChild(dt);
        line.appendChild(dd);
        list.appendChild(line);
      });
      sec.appendChild(list);
      grid.appendChild(sec);
    });
  }

  function open() {
    if (!dialog.hidden) return;
    backFocus = document.activeElement;
    render();
    dialog.hidden = false;
    var close = document.getElementById("btnShortcutsClose");
    if (close) close.focus({ preventScroll: true });
  }
  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    if (backFocus && backFocus.focus) backFocus.focus({ preventScroll: true });
    backFocus = null;
  }
  window.shortcutsOpen = open;
  window.shortcutsClose = close;

  var btn = document.getElementById("btnDiagramHelp");
  if (btn) btn.addEventListener("click", open);
  var x = document.getElementById("btnShortcutsClose");
  if (x) x.addEventListener("click", close);
  var backdrop = document.getElementById("shortcutsBackdrop");
  if (backdrop) backdrop.addEventListener("click", close);

  document.addEventListener("keydown", function (event) {
    if (!dialog.hidden) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      else if (event.key === "Tab") {
        // keep focus inside: the close button is the only focusable control
        event.preventDefault();
        if (x) x.focus({ preventScroll: true });
      }
      return;
    }
    if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey && !shortcutIsTyping(event.target)) {
      event.preventDefault();
      open();
    }
  }, true);

  if (/[?&](?:shortcuts|help)=open/.test(location.search)) open();
})();
