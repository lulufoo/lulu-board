/* Cloud hash routes. Graph ids come from board-core. */
import { GRAPH_ID_RE } from '../../../board-core/document-format.js';

export const SHARE_ID_RE = /^s_[0-9a-f]{32}$/;
export const SHORT_LINK_ID_RE = /^p_[0-9a-f]{64}$/;

export function cloudDiagramIdFromHash(raw) {
  var token = String(raw || "").replace(/^#/, "");
  if (token.indexOf("b:") !== 0) return "";
  var id = token.slice(2);
  return GRAPH_ID_RE.test(id) ? id : "";
}

export function cloudDiagramHash(diagramId) {
  var id = String(diagramId || "").trim();
  if (!GRAPH_ID_RE.test(id)) throw new Error("invalid cloud graph id");
  return "#b:" + id;
}

export function cloudShareIdFromHash(raw) {
  var token = String(raw || "").replace(/^#/, "");
  if (token.indexOf("s:") !== 0) return "";
  var id = token.slice(2);
  return SHARE_ID_RE.test(id) ? id : "";
}

export function cloudShareHash(shareId) {
  var id = String(shareId || "").trim();
  if (!SHARE_ID_RE.test(id)) throw new Error("invalid share id");
  return "#s:" + id;
}

export function cloudShortLinkIdFromHash(raw) {
  var token = String(raw || "").replace(/^#/, "");
  if (token.indexOf("p:") !== 0) return "";
  var id = token.slice(2);
  return SHORT_LINK_ID_RE.test(id) ? id : "";
}

export function cloudShortLinkHash(shortLinkId) {
  var id = String(shortLinkId || "").trim();
  if (!SHORT_LINK_ID_RE.test(id)) throw new Error("invalid short link id");
  return "#p:" + id;
}

const LuluBoardCloudRoute = {
  cloudDiagramIdFromHash: cloudDiagramIdFromHash,
  cloudDiagramHash: cloudDiagramHash,
  cloudShareIdFromHash: cloudShareIdFromHash,
  cloudShareHash: cloudShareHash,
  cloudShortLinkIdFromHash: cloudShortLinkIdFromHash,
  cloudShortLinkHash: cloudShortLinkHash,
};

export default LuluBoardCloudRoute;
