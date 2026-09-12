/**
 * Mermaid mindmap extension for Drawer.
 * Public API is intentionally small — only what drawer.html calls.
 */
import { render, normalizeLayout } from "./render.js";
import { addChild, deleteTopic, updateTopicLabel, updateTopicShape, getTopic } from "./edit.js";
import { selectionFromDom } from "./selection.js";

const MindmapEdit = {
  render,
  normalizeLayout,
  addChild,
  deleteTopic,
  updateTopicLabel,
  updateTopicShape,
  getTopic,
  selectionFromDom,
};

if (typeof window !== "undefined") {
  window.MindmapEdit = MindmapEdit;
}

export default MindmapEdit;
