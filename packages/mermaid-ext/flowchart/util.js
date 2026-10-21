/** Shared helpers. */


function fail(message) {
  throw new Error(message || "FlowchartEdit error");
}

function linesOf(source) {
  return String(source == null ? "" : source).replace(/\r\n/g, "\n").split("\n");
}

function joinLines(lines) {
  return lines.join("\n");
}

function quoteLabel(label) {
  var s = String(label == null ? "" : label);
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export {
  fail,
  linesOf,
  joinLines,
  quoteLabel,
  escapeRegExp,
};
