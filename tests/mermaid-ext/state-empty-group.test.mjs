import assert from 'node:assert/strict';
import { addComposite, addStart, deleteState } from '../../packages/mermaid-ext/state/state.js';
import { listComposites } from '../../packages/mermaid-ext/state/source.js';

const checkout = `stateDiagram-v2
  direction TB
  [*] --> Idle
  Idle --> Cart : open
  Cart --> Idle : close
  Cart --> Checkout : checkout
  state Checkout {
    [*] --> Form
    Form --> Paying : pay
    Paying --> Form : fail
    Paying --> Done : success
    Form --> [*] : cancel
  }
  Checkout --> Idle : done
  Checkout --> Idle : cancel
`;

{
  const added = addComposite(checkout, { label: 'Group' });
  assert.equal(added.selection.id, 'G1');
  assert.match(added.source, /state "state" as S1/);
  const started = addStart(added.source, { to: 'S1', parent: 'G1' });
  assert.match(started.source, /\[\*\] --> S1/);
  const deleted = deleteState(started.source, 'S1');
  assert.doesNotMatch(deleted.source, /state "Group" as G1/);
  assert.doesNotMatch(deleted.source, /state "state" as S1/);
  assert.equal(listComposites(deleted.source).map((c) => c.id).join(','), 'Checkout');
}

{
  const added = addComposite(checkout, { label: 'Group', parent: 'Checkout' });
  const started = addStart(added.source, { to: 'S1', parent: 'G1' });
  const deleted = deleteState(started.source, 'S1');
  assert.doesNotMatch(deleted.source, /state "Group" as G1/);
  assert.ok(listComposites(deleted.source).some((c) => c.id === 'Checkout'));
}

{
  const deleted = deleteState(checkout, 'Form');
  assert.ok(listComposites(deleted.source).some((c) => c.id === 'Checkout'));
  assert.match(deleted.source, /state Checkout \{/);
}

{
  const added = addComposite(checkout, { label: 'Group' });
  const linked =
    added.source.replace(/\s*$/, '') + '\n  Idle --> G1\n';
  const deleted = deleteState(linked, 'S1');
  assert.match(deleted.source, /state "Group" as G1 \{/);
  assert.match(deleted.source, /Idle --> G1/);
}

console.log('ok state-empty-group');
