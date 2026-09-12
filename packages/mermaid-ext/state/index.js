/** Mermaid state diagram source editor (Drawer). */
import {
  isState,
  ensureState,
  collectIds,
  nextId,
  listStates,
  listComposites,
  findCompositeRange,
  parseStateHeader,
} from './source.js';
import { STATE_KINDS, stateKinds, normalizeStateKind } from './kinds.js';
import {
  getState,
  updateStateLabel,
  updateStateId,
  addState,
  addComposite,
  addStart,
  hasStart,
  deleteState,
} from './state.js';
import {
  listTransitions,
  getTransition,
  parseTransitionLine,
  transitionKey,
  updateTransitionLabel,
  addTransition,
  deleteTransition,
} from './transition.js';
import { selectionFromDom, clusterParentFromDom } from './selection.js';
import { deleteSelection } from './delete.js';

const StateEdit = {
  isState,
  ensureState,
  collectIds,
  nextId,
  stateKinds,
  normalizeStateKind,
  kinds: STATE_KINDS,
  listStates,
  listComposites,
  findCompositeRange,
  parseStateHeader,
  getState,
  updateStateLabel,
  updateStateId,
  addState,
  addComposite,
  addStart,
  hasStart,
  deleteState,
  listTransitions,
  getTransition,
  parseTransitionLine,
  transitionKey,
  updateTransitionLabel,
  addTransition,
  deleteTransition,
  deleteSelection,
  selectionFromDom,
  clusterParentFromDom,
};

export { StateEdit };
export default StateEdit;

const root = typeof window !== 'undefined' ? window : globalThis;
root.StateEdit = StateEdit;
