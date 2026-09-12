/** Mermaid flowchart source editor (Drawer). */
import { isFlowchart } from './source.js';
import { SHAPES, NODE_KINDS, nodeKinds, kindFromShape, shapeFromKind, normalizeNodeKind, shapeKeys } from './kinds.js';
import { collectIds, findSubgraphRange, isEmptySubgraph } from './source.js';
import {
  addNode, getNode, updateNodeLabel, updateNodeShape, updateNodeKind, updateNodeId, deleteNode,
} from './node.js';
import {
  addLink, getLink, updateLinkLabel, updateLinkStroke, deleteLink,
} from './link.js';
import {
  listSubgraphs, resolveSubgraphRef, addSubgraph, getSubgraph, updateSubgraphTitle, updateSubgraphId, deleteSubgraph, deleteSelection,
} from './subgraph.js';
import { selectionFromDom } from './selection.js';

const FlowchartEdit = {
  isFlowchart,
  shapes: shapeKeys,
  nodeKinds,
  kindFromShape,
  shapeFromKind,
  normalizeNodeKind,
  addNode,
  addLink,
  listSubgraphs,
  resolveSubgraphRef,
  addSubgraph,
  deleteNode,
  deleteLink,
  deleteSubgraph,
  deleteSelection,
  getNode,
  getLink,
  getSubgraph,
  updateNodeLabel,
  updateNodeShape,
  updateNodeKind,
  updateNodeId,
  updateLinkLabel,
  updateLinkStroke,
  updateSubgraphTitle,
  updateSubgraphId,
  selectionFromDom,
  collectIds,
  findSubgraphRange,
  isEmptySubgraph,
};

export { FlowchartEdit };
export default FlowchartEdit;

const root = typeof window !== 'undefined' ? window : globalThis;
root.FlowchartEdit = FlowchartEdit;
