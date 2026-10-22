'use strict';
const assert = require('assert');
const Meta = require('../../packages/drawer-app/js/00-document-meta.js');

assert.strictEqual(Meta.diagramTitleFromBody('board "Onboarding"\nbox A\n'), 'Onboarding');
assert.strictEqual(Meta.diagramTitleFromBody('%% title Demo\nflowchart TD\n  A-->B\n'), 'Demo');
assert.strictEqual(Meta.diagramTitleFromBody('%% title: "Ship"\nflowchart TD\n  A-->B\n'), 'Ship');
assert.strictEqual(Meta.diagramTitleFromBody('flowchart TD\n  A-->B\n'), '');
assert.notStrictEqual(Meta.diagramTitleFromBody('flowchart TD\n  A-->B\n'), 'flowchart');

console.log('ok board-title');
