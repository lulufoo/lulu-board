/* drawer-app/10-source-style.js — Source panel look: syntax colours, current line.
   A highlighted <pre> sits behind the transparent #boardSource; the textarea stays the editor. */
(function wireSourceStyle() {
  var ta = document.getElementById("boardSource");
  var editor = ta && ta.closest(".source-line-editor");
  var gutter = editor && editor.querySelector(".source-gutter");
  if (!ta || !editor || !gutter || ta.dataset.hl === "1") return;
  ta.dataset.hl = "1";

  var wrap = document.createElement("div");
  wrap.className = "source-hl-wrap";
  var pre = document.createElement("pre");
  pre.className = "source-hl";
  pre.setAttribute("aria-hidden", "true");
  ta.parentNode.insertBefore(wrap, ta);
  wrap.appendChild(pre);
  wrap.appendChild(ta);

  var TOKEN = /("(?:\\.|[^"\\])*"?)|(<->|<-|-->|->|--)|([A-Za-z_][\w-]*|\d+(?:\.\d+)?)|(\s+)|([\s\S])/g;

  function addText(parent, text, cls) {
    if (!cls) { parent.appendChild(document.createTextNode(text)); return; }
    var span = document.createElement("span");
    span.className = cls;
    span.textContent = text;
    parent.appendChild(span);
  }

  function tokenizeLine(text, parent) {
    if (!text.length) { parent.appendChild(document.createTextNode("\u200b")); return; }
    var first = true;
    var m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) {
      if (m[1]) { addText(parent, m[1], "hl-str"); first = false; }
      else if (m[2]) { addText(parent, m[2], "hl-arrow"); first = false; }
      else if (m[3]) {
        var word = m[3];
        var cls = "";
        if (first && /^[a-z][a-z-]*$/.test(word)) cls = "hl-kw";
        else if (word.length > 24) cls = "hl-blob";
        else if (/^[A-Z][A-Z0-9_]*$/.test(word)) cls = "hl-id";
        else if (/^\d/.test(word)) cls = "hl-num";
        else if (/^[a-z][a-z-]*$/.test(word)) cls = "hl-key";
        addText(parent, word, cls);
        first = false;
      } else addText(parent, m[0], "");
    }
  }

  function currentLine() {
    return ta.value.slice(0, ta.selectionStart || 0).split("\n").length - 1;
  }

  function markCurrent() {
    var idx = currentLine();
    var focused = document.activeElement === ta;
    var lines = pre.children;
    for (var i = 0; i < lines.length; i += 1) lines[i].classList.toggle("is-current", focused && i === idx);
    var nums = gutter.querySelectorAll(".source-gutter-line");
    for (var j = 0; j < nums.length; j += 1) nums[j].classList.toggle("is-current", focused && j === idx);
  }

  function syncScroll() {
    pre.style.right = Math.max(0, ta.offsetWidth - ta.clientWidth) + "px";
    pre.scrollTop = ta.scrollTop;
  }

  function render() {
    var frag = document.createDocumentFragment();
    String(ta.value).split("\n").forEach(function (text) {
      var line = document.createElement("span");
      line.className = "hl-line";
      var ind = Math.min(4, Math.floor((/^ */.exec(text)[0].length) / 2));
      if (ind > 0) line.classList.add("ind-" + ind);
      tokenizeLine(text, line);
      frag.appendChild(line);
    });
    pre.replaceChildren(frag);
    syncScroll();
    markCurrent();
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; render(); });
  }

  ta.addEventListener("input", schedule);
  ta.addEventListener("scroll", syncScroll);
  ta.addEventListener("keyup", markCurrent);
  ta.addEventListener("click", markCurrent);
  ta.addEventListener("focus", markCurrent);
  ta.addEventListener("blur", markCurrent);
  document.addEventListener("selectionchange", function () { if (document.activeElement === ta) markCurrent(); });
  if (typeof ResizeObserver === "function") new ResizeObserver(schedule).observe(ta);
  new MutationObserver(markCurrent).observe(gutter, { childList: true, subtree: true });

  // programmatic value writes (load board, undo) must repaint too
  var own = Object.getOwnPropertyDescriptor(ta, "value");
  var proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  var base = own && own.get && own.set ? own : proto;
  if (base && base.get && base.set) {
    Object.defineProperty(ta, "value", {
      configurable: true,
      get: function () { return base.get.call(this); },
      set: function (next) { base.set.call(this, next); schedule(); },
    });
  }
  schedule();
})();
