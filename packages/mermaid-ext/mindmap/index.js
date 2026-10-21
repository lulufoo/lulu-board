/** Mermaid mindmap source editor (Drawer). Layout / draw land in a later issue. */
import { parseMindmap } from "./parse.js";
import { serializeMindmap } from "./source.js";
import { addChild, deleteTopic, updateTopicLabel, updateTopicShape, getTopic } from "./edit.js";
import { selectionFromDom } from "./selection.js";

const MindmapEdit = {
  parseMindmap,
  serializeMindmap,
  addChild,
  deleteTopic,
  updateTopicLabel,
  updateTopicShape,
  getTopic,
  selectionFromDom,
};

export { MindmapEdit };
export default MindmapEdit;

const root = typeof window !== "undefined" ? window : globalThis;
root.MindmapEdit = MindmapEdit;
