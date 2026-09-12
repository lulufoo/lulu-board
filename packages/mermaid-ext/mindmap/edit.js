import { parseMindmap } from "./parse.js";
import { serializeMindmap, findNodeById, findParent, reassignIds } from "./source.js";

function parseOrThrow(source) {
  const { root, errors } = parseMindmap(source);
  if (!root) throw new Error(errors.join("; ") || "Empty mindmap");
  return root;
}

function result(root, selectionNode) {
  reassignIds(root);
  return {
    source: serializeMindmap(root),
    selection: selectionNode
      ? {
          kind: "topic",
          id: selectionNode.id,
          key: "topic:" + selectionNode.id,
          label: selectionNode.label,
          shape: "default",
          depth: selectionNode.depth,
          isRoot: selectionNode.id === root.id,
        }
      : null,
  };
}

function newNode(label, shape) {
  return {
    id: -1,
    label: label || "Node",
    shape: shape || "default",
    idHint: null,
    children: [],
    depth: 0,
    section: 0,
  };
}

function resolveParent(root, parentId) {
  if (parentId == null || parentId === "") return root;
  return findNodeById(root, parentId) || root;
}

/** Add a child under any node (including root). */
export function addChild(source, parentId, label) {
  const root = parseOrThrow(source);
  const parent = resolveParent(root, parentId);
  const node = newNode(label || "Node", "default");
  parent.children = parent.children || [];
  parent.children.push(node);
  return result(root, node);
}

export function deleteTopic(source, topicId) {
  const root = parseOrThrow(source);
  const id = Number(topicId);
  if (root.id === id) throw new Error("Cannot delete the root topic");
  const parent = findParent(root, id);
  if (!parent) throw new Error("Topic not found");
  parent.children = (parent.children || []).filter((c) => c.id !== id);
  return result(root, parent);
}

export function updateTopicLabel(source, topicId, label) {
  const root = parseOrThrow(source);
  const node = findNodeById(root, topicId);
  if (!node) throw new Error("Topic not found");
  node.label = String(label || "").trim() || node.label;
  return result(root, node);
}

/** @deprecated Shape UI removed — always default pill. Kept as no-op for callers. */
export function updateTopicShape(source, topicId, _shape) {
  const root = parseOrThrow(source);
  const node = findNodeById(root, topicId);
  if (!node) throw new Error("Topic not found");
  node.shape = "default";
  return result(root, node);
}

export function getTopic(source, topicId) {
  const root = parseOrThrow(source);
  const node = findNodeById(root, topicId);
  if (!node) return null;
  return {
    id: node.id,
    label: node.label,
    shape: "default",
    depth: node.depth,
    section: node.section,
    childCount: (node.children || []).length,
    isRoot: node.id === root.id,
  };
}
