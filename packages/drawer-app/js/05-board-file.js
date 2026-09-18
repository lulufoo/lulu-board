/* drawer-app/05-board-file.js — board title from source */
function boardTitleFromBody(body) {
  var hit = /^\s*board\s+"([^"]*)"/.exec(String(body || ""));
  return hit ? hit[1] : "";
}
