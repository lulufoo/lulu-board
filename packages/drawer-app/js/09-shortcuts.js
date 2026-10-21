/* drawer-app/09-shortcuts.js — the Keyboard shortcuts dialog. SHORTCUT_GROUPS is the one list;
   each row names the file and a snippet of its real binding (tests check the binding exists).
   Key tokens: "Mod" = ⌘ on Mac / Ctrl elsewhere, "Alt" = ⌥ / Alt. */
var SHORTCUT_GROUPS = [
  { title: "Workspace", rows: [
    { label: "Search boards", keys: [["Mod", "K"]], src: "09-shell-drawer.js", probe: 'event.key.toLowerCase() === "k"' },
    { label: "Toggle Source panel", keys: [["Mod", "\\"]], src: "07-chrome-boot.js", probe: "e.key === '\\\\'" },
    { label: "Re-render board", keys: [["Mod", "Enter"]], src: "07-chrome-boot.js", probe: "e.key === 'Enter'" },
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

  var btn = document.getElementById("btnBoardShortcuts");
  if (btn) btn.addEventListener("click", open);
  wireHelpMenu();
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

  if (/[?&]shortcuts=open/.test(location.search)) open();
})();

// One "?" dock entry: a small menu with Welcome and Keyboard shortcuts.
function wireHelpMenu() {
  var trigger = document.getElementById("btnVelaHelp");
  var menu = document.getElementById("velaHelpMenu");
  if (!trigger || !menu) return;
  function items() { return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]')); }
  function place() {
    var r = trigger.getBoundingClientRect();
    menu.style.visibility = "hidden";
    menu.hidden = false;
    var h = menu.offsetHeight, w = menu.offsetWidth;
    menu.style.top = Math.max(8, Math.min(r.top, window.innerHeight - h - 8)) + "px";
    menu.style.left = Math.max(8, r.left - w - 8) + "px";
    menu.style.visibility = "";
  }
  function setOpen(want, focusFirst) {
    if (want) {
      place();
      trigger.setAttribute("aria-expanded", "true");
      trigger.classList.add("is-active");
      if (focusFirst) items()[0].focus({ preventScroll: true });
    } else if (!menu.hidden) {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      trigger.classList.remove("is-active");
    }
  }
  window.helpMenuSetOpen = setOpen;
  trigger.addEventListener("click", function (event) { setOpen(menu.hidden, event.detail === 0); });
  trigger.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true, true); }
  });
  items().forEach(function (item) {
    // close first, then the item's own click handler runs (Welcome / dialog)
    item.addEventListener("click", function () { setOpen(false); }, true);
  });
  menu.addEventListener("keydown", function (event) {
    var list = items();
    var i = list.indexOf(document.activeElement);
    if (event.key === "ArrowDown") { event.preventDefault(); list[(i + 1) % list.length].focus(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    else if (event.key === "Home") { event.preventDefault(); list[0].focus(); }
    else if (event.key === "End") { event.preventDefault(); list[list.length - 1].focus(); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.focus({ preventScroll: true }); }
    else if (event.key === "Tab") setOpen(false);
  });
  document.addEventListener("pointerdown", function (event) {
    if (menu.hidden || menu.contains(event.target) || trigger.contains(event.target)) return;
    setOpen(false);
  }, true);
  window.addEventListener("resize", function () { if (!menu.hidden) place(); });
  // review link: ?help=open shows the menu
  if (/[?&]help=open/.test(location.search)) setOpen(true);
}
