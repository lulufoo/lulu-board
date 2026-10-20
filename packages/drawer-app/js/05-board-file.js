/* drawer-app/05-board-file.js — board title from source */
function boardTitleFromBody(body) {
  var text = String(body || "");
  var board = /^\s*board\s+"([^"]*)"/.exec(text);
  if (board) return board[1];
  var lines = text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i += 1) {
    var mermaid = /^%%\s*title\s*:?\s*(.+?)\s*$/i.exec(String(lines[i] || "").trim());
    if (!mermaid) continue;
    var title = mermaid[1].replace(/^["']|["']$/g, "").trim();
    if (title) return title;
  }
  return "";
}
