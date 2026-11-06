/* Cloud layer. Chrome leftover is reached through hooks. */

import {
  cloudSession,
} from './cloud-state.js';

/* drawer-app/06-cloud-search.js — login search: own boards plus others' public boards. */

function cloudSearchSignedIn() {
  return !!(typeof cloudSession !== "undefined" && cloudSession && cloudSession.user);
}

function cloudSearchSplit(rows) {
  var mine = [];
  var pub = [];
  (rows || []).forEach(function (row) {
    if (!row) return;
    var item = {
      title: row.title || "",
      shareId: row.share_id || "",
      diagramId: row.graph_id || "",
      note: row.category === "public" ? "Public" : "Mine",
    };
    if (row.category === "public") pub.push(item);
    else mine.push(item);
  });
  return { mine: mine, public: pub };
}

async function cloudSearchDiagrams(query) {
  var q = String(query || "").trim();
  var accessToken = cloudSession && cloudSession.access_token;
  if (!q || !accessToken) return { mine: [], public: [] };
  var response = await fetch("https://api.luluboard.app/search", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: q }),
  });
  var text = await response.text();
  var body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    var fail = body && (body.message || body.error) || ("HTTP " + response.status);
    throw new Error(fail);
  }
  return cloudSearchSplit(body);
}

export {
  cloudSearchSignedIn,
  cloudSearchDiagrams,
};
