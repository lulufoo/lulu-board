/** UI kinds for Mermaid state diagrams. Protocol stays Mermaid stateDiagram-v2. */

var STATE_KINDS = {
  state: { label: "state" },
  composite: { label: "composite" },
  pseudostate: { label: "pseudostate" },
  transition: { label: "transition" },
  // note: deferred
};

function stateKinds() {
  return ["state", "composite", "pseudostate", "transition"];
}

function normalizeStateKind(kind) {
  kind = String(kind || "state");
  return STATE_KINDS[kind] ? kind : "state";
}

export {
  STATE_KINDS,
  stateKinds,
  normalizeStateKind,
};
