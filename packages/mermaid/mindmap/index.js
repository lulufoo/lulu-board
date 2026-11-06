/** Mermaid mindmap source editor + custom SVG render (Drawer). */
import { parseMindmap } from "./parse.js";
import { serializeMindmap, getTitle, updateTitle } from "./source.js";
import { addChild, deleteTopic, updateTopicLabel, getTopic } from "./edit.js";
import { selectionFromDom } from "./selection.js";
import { render, normalizeLayout } from "./render.js";

const MindmapEdit = {
  parseMindmap,
  serializeMindmap,
  getTitle,
  updateTitle,
  addChild,
  deleteTopic,
  updateTopicLabel,
  getTopic,
  selectionFromDom,
  render,
  normalizeLayout,
};

export { MindmapEdit };
export default MindmapEdit;
