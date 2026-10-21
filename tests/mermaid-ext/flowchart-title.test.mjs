import assert from 'node:assert/strict';
import { getTitle, updateTitle, updateDirection } from '../../packages/mermaid-ext/flowchart/source.js';

assert.equal(getTitle('%% title Demo\nflowchart TD\n  A-->B\n'), 'Demo');
assert.equal(getTitle('%% title: "Ship"\nflowchart TD\n  A-->B\n'), 'Ship');
assert.equal(getTitle('flowchart TD\n  A-->B\n'), '');

{
  const next = updateTitle('flowchart TD\n  A-->B\n', 'Checkout');
  assert.match(next.source, /^%% title Checkout\nflowchart TD\n/);
  assert.equal(getTitle(next.source), 'Checkout');
}

{
  const next = updateTitle('%% title Demo\nflowchart TD\n  A-->B\n', 'Ship');
  assert.match(next.source, /^%% title Ship\nflowchart TD\n/);
  assert.equal(getTitle(next.source), 'Ship');
}

{
  const next = updateTitle('%% title Demo\nflowchart TD\n  A-->B\n', '');
  assert.doesNotMatch(next.source, /%%\s*title/);
  assert.equal(getTitle(next.source), '');
}

{
  const turned = updateDirection('%% title Demo\nflowchart TD\n  A-->B\n', 'LR');
  assert.match(turned.source, /^%% title Demo\nflowchart LR\n/);
  const named = updateTitle(turned.source, 'Demo');
  assert.match(named.source, /^%% title Demo\nflowchart LR\n/);
}

console.log('ok flowchart-title');
