import assert from 'node:assert/strict';
import { parseMindmap } from '../../packages/mermaid-ext/mindmap/parse.js';
import { addChild, deleteTopic, updateTopicLabel, getTopic } from '../../packages/mermaid-ext/mindmap/edit.js';
import { selectionFromDom } from '../../packages/mermaid-ext/mindmap/selection.js';

const source = `mindmap
  Root
    A
    A
`;

{
  const { root, errors } = parseMindmap(source);
  assert.equal(errors.length, 0);
  assert.equal(root.label, 'Root');
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0].label, 'A');
  assert.equal(root.children[1].label, 'A');
  assert.deepEqual(root.path, []);
  assert.deepEqual(root.children[0].path, [0]);
  assert.deepEqual(root.children[1].path, [1]);
}

{
  const folded = parseMindmap(`mindmap
  One
  Two
`);
  assert.equal(folded.root.label, 'One');
  assert.equal(folded.root.children.length, 1);
  assert.equal(folded.root.children[0].label, 'Two');
  assert.match(folded.errors.join(' '), /Multiple roots/);
}

{
  const added = addChild(source, 0, 'Child');
  assert.match(added.source, /Child/);
  assert.equal(getTopic(added.source, added.selection.path).label, 'Child');
  assert.deepEqual(added.selection.path, [2]);
  assert.equal(added.selection.key, 'topic:2');
}

{
  const added = addChild(source, [0], 'Kid');
  const gone = deleteTopic(added.source, added.selection.path);
  assert.ok(!/Kid/.test(gone.source));
  assert.equal(getTopic(gone.source, [0]).label, 'A');
}

{
  assert.throws(() => deleteTopic(source, 0), /Cannot delete the root topic/);
  assert.throws(() => deleteTopic(source, []), /Cannot delete the root topic/);
}

{
  const renamed = updateTopicLabel(source, [0], 'B');
  assert.equal(getTopic(renamed.source, [0]).label, 'B');
  assert.equal(getTopic(renamed.source, [1]).label, 'A');
  assert.equal(getTopic(renamed.source, 0).label, 'Root');
}

{
  function mock(path, id, label) {
    const el = {
      getAttribute(name) {
        if (name === 'data-path') return path;
        if (name === 'data-id') return id;
        return '';
      },
      querySelector(sel) {
        return sel === 'text' ? { textContent: label } : null;
      },
      closest(sel) {
        return sel === 'g.mindmap-node' ? el : null;
      },
    };
    return el;
  }
  const first = selectionFromDom(mock('0', '1', 'A'));
  const second = selectionFromDom(mock('1', '2', 'A'));
  assert.equal(first.label, 'A');
  assert.equal(second.label, 'A');
  assert.notEqual(first.key, second.key);
  assert.deepEqual(first.path, [0]);
  assert.deepEqual(second.path, [1]);
}

console.log('ok mindmap-edit');
