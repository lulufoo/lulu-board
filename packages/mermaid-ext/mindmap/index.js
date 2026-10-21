/** Mermaid mindmap source editor + custom SVG render (Drawer). */
import { parseMindmap } from "./parse.js";
import { serializeMindmap } from "./source.js";
import { addChild, deleteTopic, updateTopicLabel, updateTopicShape, getTopic } from "./edit.js";
import { selectionFromDom } from "./selection.js";
import { render, normalizeLayout } from "./render.js";

const MindmapEdit = {
  parseMindmap,
  serializeMindmap,
  addChild,
  deleteTopic,
  updateTopicLabel,
  updateTopicShape,
  getTopic,
  selectionFromDom,
  render,
  normalizeLayout,
};

export { MindmapEdit };
export default MindmapEdit;

const root = typeof window !== "undefined" ? window : globalThis;
root.MindmapEdit = MindmapEdit;
