/** deleteSelection for state kinds. */

import { fail } from './util.js';
import { deleteState } from './state.js';
import { deleteTransition } from './transition.js';

function deleteSelection(source, sel) {
  if (!sel || !sel.kind) fail("nothing selected");
  if (sel.kind === "state" || sel.kind === "composite") {
    return deleteState(source, sel.id);
  }
  if (sel.kind === "transition") {
    return deleteTransition(source, sel);
  }
  if (sel.kind === "pseudostate") fail("cannot delete pseudostate [*] from selection");
  fail("unsupported selection kind: " + sel.kind);
}

export { deleteSelection };
