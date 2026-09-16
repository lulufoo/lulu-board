/* Logical line numbers beside #boardSource. Wrapped display still one number. */
function sourceLineTwin() {
  var el = document.querySelector(".source-line-twin");
  if (el) return el;
  el = document.createElement("textarea");
  el.className = "source-line-twin";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  return el;
}
function sourceLineHeights(textarea) {
  var cs = getComputedStyle(textarea);
  var padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  var min = parseFloat(cs.lineHeight);
  if (!Number.isFinite(min) || min < 8) min = 19;
  var twin = sourceLineTwin();
  twin.style.boxSizing = cs.boxSizing;
  twin.style.width = textarea.clientWidth + "px";
  twin.style.font = cs.font;
  twin.style.lineHeight = cs.lineHeight;
  twin.style.letterSpacing = cs.letterSpacing;
  twin.style.wordSpacing = cs.wordSpacing;
  twin.style.tabSize = cs.tabSize;
  twin.style.padding = cs.padding;
  twin.style.border = "0";
  twin.style.whiteSpace = cs.whiteSpace;
  twin.style.overflowWrap = cs.overflowWrap;
  twin.style.wordBreak = cs.wordBreak;
  var lines = String(textarea.value).split("\n");
  var heights = [];
  var i;
  for (i = 0; i < lines.length; i++) {
    twin.value = lines[i].length ? lines[i] : " ";
    heights.push(Math.max(min, twin.scrollHeight - padY));
  }
  return heights;
}
function renderSourceGutter(gutter, heights) {
  var inner = gutter.querySelector(".source-gutter-inner");
  if (!inner) {
    inner = document.createElement("div");
    inner.className = "source-gutter-inner";
    gutter.appendChild(inner);
  }
  var n = heights.length;
  var digits = String(Math.max(1, n)).length;
  gutter.style.minWidth = (Math.max(2, digits) + 1.6) + "ch";
  var html = "";
  var i;
  for (i = 0; i < n; i++) {
    html += "<div class=\"source-gutter-line\" style=\"height:" + heights[i] + "px\">" + (i + 1) + "</div>";
  }
  inner.innerHTML = html;
}
function refreshSourceLineEditor(textarea, gutter) {
  if (!textarea || !gutter || textarea.clientWidth < 8) return;
  renderSourceGutter(gutter, sourceLineHeights(textarea));
  gutter.scrollTop = textarea.scrollTop;
}
function wireSourceLineEditor(textarea) {
  if (!textarea || textarea.dataset.sourceLinesWired === "1") return;
  var wrap = textarea.closest(".source-line-editor");
  var gutter = wrap && wrap.querySelector(".source-gutter");
  if (!wrap || !gutter) return;
  textarea.dataset.sourceLinesWired = "1";
  var ticking = false;
  var refresh = function() {
    ticking = false;
    refreshSourceLineEditor(textarea, gutter);
  };
  var schedule = function() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(refresh);
  };
  textarea.addEventListener("input", schedule);
  textarea.addEventListener("scroll", function() { gutter.scrollTop = textarea.scrollTop; });
  if (typeof ResizeObserver === "function") {
    var ro = new ResizeObserver(schedule);
    ro.observe(textarea);
    ro.observe(wrap);
  }
  var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  if (desc && desc.set && desc.get) {
    Object.defineProperty(textarea, "value", {
      configurable: true,
      get: function() { return desc.get.call(this); },
      set: function(next) { desc.set.call(this, next); schedule(); }
    });
  }
  schedule();
}
wireSourceLineEditor(typeof boardSourceEl !== "undefined" ? boardSourceEl : document.getElementById("boardSource"));
