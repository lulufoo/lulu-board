/* New-diagram templates: load ./templates/<kind> and retitle Untitled. */
import { stripDocumentMeta, updateMermaidTitle } from './document-meta.js';

const FILES = {
  welcome: "welcome.bmd",
  boxes: "boxes.bmd",
  sketch: "sketch.skt",
  flowchart: "flowchart.mmd",
  mindmap: "mindmap.mmd",
  sequence: "sequenceDiagram.mmd",
  sequenceDiagram: "sequenceDiagram.mmd",
  class: "classDiagram.mmd",
  classDiagram: "classDiagram.mmd",
  state: "stateDiagram.mmd",
  stateDiagram: "stateDiagram.mmd",
  "stateDiagram-v2": "stateDiagram.mmd",
  er: "erDiagram.mmd",
  erDiagram: "erDiagram.mmd",
  requirement: "requirement.mmd",
  requirementDiagram: "requirement.mmd",
  c4: "C4Context.mmd",
  C4Context: "C4Context.mmd",
  usecase: "usecase-beta.mmd",
  "usecase-beta": "usecase-beta.mmd",
  eventmodeling: "eventmodeling.mmd",
  railroad: "railroad-beta.mmd",
  "railroad-beta": "railroad-beta.mmd",
};

export function kindTemplateFileName(kind) {
  var key = String(kind || "").trim();
  if (!key) return FILES.boxes;
  return FILES[key] || "";
}

function applyBoardTitle(source, title) {
  var name = String(title == null ? "Untitled" : title).replace(/"/g, "");
  if (!name) name = "Untitled";
  var text = String(source == null ? "" : source).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  var hit = /^\s*boxes\s+"/im.exec(text);
  if (hit) {
    return text.replace(/^\s*boxes\s+"[^"]*"/im, "boxes \"" + name + "\"");
  }
  return "boxes \"" + name + "\"\n" + text.replace(/^\n+/, "");
}

export function applyUntitledTitle(source) {
  var text = String(source == null ? "" : source);
  if (/^\s*sketch\s+"/m.test(text)) return text;
  if (/^\s*boxes\s+"/m.test(text)) return applyBoardTitle(text, "Untitled");
  return updateMermaidTitle(text, "Untitled");
}

export async function loadKindTemplateSource(kind) {
  var file = kindTemplateFileName(kind);
  if (!file) throw new Error("Template is unavailable");
  if (typeof fetch !== "function") throw new Error("Template is unavailable");
  var res = await fetch("./templates/" + file, { cache: "no-store" });
  if (!res.ok) throw new Error("Template is unavailable");
  var text = await res.text();
  text = stripDocumentMeta(text);
  if (!String(text).trim()) throw new Error("Template is unavailable");
  return applyUntitledTitle(text);
}

const DrawerKindTemplate = {
  kindTemplateFileName: kindTemplateFileName,
  applyUntitledTitle: applyUntitledTitle,
  loadKindTemplateSource: loadKindTemplateSource,
};

export default DrawerKindTemplate;
