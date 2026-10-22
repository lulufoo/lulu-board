import { parseMindmap } from "./parse.js";
import { serializeMindmap, findNodeByRef, findParent, reassignIds, topicKey, getTitle, updateTitle } from "./source.js";

function parseOrThrow(source) {
  const { root, errors } = parseMindmap(source);
  if (!root) throw new Error(errors.join("; ") || "Empty mindmap");
  return root;
}

function result(root, selectionNode, source) {
  reassignIds(root);
  let next = serializeMindmap(root);
  const title = getTitle(source);
  if (title) next = updateTitle(next, title).source;
  return {
    source: next,
    selection: selectionNode
      ? {
          kind: "topic",
          id: selectionNode.id,
          path: selectionNode.path.slice(),
          key: topicKey(selectionNode.path),
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
    path: [],
  };
}

function resolveParent(root, parentId) {
  if (parentId == null || parentId === "") return root;
  return findNodeByRef(root, parentId) || root;
}

export function addChild(source, parentId, label) {
  const root = parseOrThrow(source);
  const parent = resolveParent(root, parentId);
  const node = newNode(label || "Node", "default");
  parent.children = parent.children || [];
  parent.children.push(node);
  return result(root, node, source);
}

export function deleteTopic(source, topicId) {
  const root = parseOrThrow(source);
  const node = findNodeByRef(root, topicId);
  if (!node) throw new Error("Topic not found");
  if (node === root) throw new Error("Cannot delete the root topic");
  const parent = findParent(root, node.id);
  if (!parent) throw new Error("Topic not found");
  parent.children = (parent.children || []).filter((c) => c.id !== node.id);
  return result(root, parent, source);
}

export function updateTopicLabel(source, topicId, label) {
  const root = parseOrThrow(source);
  const node = findNodeByRef(root, topicId);
  if (!node) throw new Error("Topic not found");
  node.label = String(label || "").trim() || node.label;
  return result(root, node, source);
}

/** Shape UI removed — always default pill. Kept as no-op for callers. */
export function updateTopicShape(source, topicId, _shape) {
  const root = parseOrThrow(source);
  const node = findNodeByRef(root, topicId);
  if (!node) throw new Error("Topic not found");
  node.shape = "default";
  return result(root, node, source);
}

export function getTopic(source, topicId) {
  const root = parseOrThrow(source);
  const node = findNodeByRef(root, topicId);
  if (!node) return null;
  return {
    id: node.id,
    path: node.path.slice(),
    key: topicKey(node.path),
    label: node.label,
    shape: "default",
    depth: node.depth,
    section: node.section,
    childCount: (node.children || []).length,
    isRoot: node.id === root.id,
  };
}
