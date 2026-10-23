/* drawer-app/00-kind-template.js — New loads ./templates/<kind> and retitles Untitled. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DrawerKindTemplate = api;
  root.kindTemplateFileName = api.kindTemplateFileName;
  root.applyUntitledTitle = api.applyUntitledTitle;
  root.loadKindTemplateSource = api.loadKindTemplateSource;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FILES = {
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

  function kindTemplateFileName(kind) {
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

  function applyUntitledTitle(source) {
    var text = String(source == null ? "" : source);
    if (/^\s*sketch\s+"/m.test(text)) return text;
    if (/^\s*boxes\s+"/m.test(text)) return applyBoardTitle(text, "Untitled");
    if (typeof updateMermaidTitle === "function") return updateMermaidTitle(text, "Untitled");
    return "%% title Untitled\n" + text.replace(/^\n+/, "");
  }

  async function loadKindTemplateSource(kind) {
    var file = kindTemplateFileName(kind);
    if (!file) throw new Error("Template is unavailable");
    if (typeof fetch !== "function") throw new Error("Template is unavailable");
    var res = await fetch("./templates/" + file, { cache: "no-store" });
    if (!res.ok) throw new Error("Template is unavailable");
    var text = await res.text();
    if (typeof stripDocumentMeta === "function") text = stripDocumentMeta(text);
    if (!String(text).trim()) throw new Error("Template is unavailable");
    return applyUntitledTitle(text);
  }

  return {
    kindTemplateFileName: kindTemplateFileName,
    applyUntitledTitle: applyUntitledTitle,
    loadKindTemplateSource: loadKindTemplateSource,
  };
});
var kindTemplateFileName = globalThis.kindTemplateFileName;
var applyUntitledTitle = globalThis.applyUntitledTitle;
var loadKindTemplateSource = globalThis.loadKindTemplateSource;
