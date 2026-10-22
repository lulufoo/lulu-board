'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'packages/drawer-app/css/03-diagram.css'), 'utf8');
const diagram = fs.readFileSync(path.join(root, 'packages/drawer-app/js/02-diagram.js'), 'utf8');

assert.match(diagram, /html\.dataset\.pele = "1"/, 'flowchart and Design mark the Pele host');
assert.match(diagram, /syncMermaidStyleChrome/, 'Design paint applies theme vars');
assert.match(css, /html\[data-pele="1"\] \{/, 'Design inherits Pele token aliases');
assert.match(css, /html\[data-pele="1"\] #preview > svg \{/, 'Design SVG is not stretched to 100%');
assert.match(css, /html\[data-pele="1"\] \.board-edit-tools/, 'Design hides Board tools');

const peleSrc = fs.readFileSync(path.join(root, 'packages/drawer-app/vendor/pele.global.js'), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(peleSrc + '; this.pele = pele;', ctx);

const samples = {
  sequence: 'sequenceDiagram\n  actor User\n  participant UI\n  User->>UI: action\n',
  class: 'classDiagram\n  class Service {\n    +run()\n  }\n',
  state: 'stateDiagram-v2\n  [*] --> Idle\n',
  er: 'erDiagram\n  USER ||--o{ NOTE : writes\n',
  requirement: 'requirementDiagram\n  requirement auth {\n    id: 1\n    text: user must sign in\n    risk: high\n    verifymethod: test\n  }\n',
  c4: 'C4Context\n  title System Context — Example\n  Person(user, "User", "Uses the product")\n  System(app, "Example System", "Our system")\n  Rel(user, app, "Uses")\n',
  usecase: 'usecase-beta\nactor Customer\nCheckout("Place order")\nCustomer --> Checkout\n',
  eventmodeling: 'eventmodeling\ntf 01 ui CartUI\ntf 02 cmd AddItem\ntf 03 evt ItemAdded\n',
  railroad: 'railroad-beta\nrule = terminal("hello");\n',
};

Object.keys(samples).forEach(function (kind) {
  const svg = ctx.pele.render(samples[kind]).svg || '';
  assert.ok(svg.indexOf('var(--_s)') >= 0, kind + ' fill reads --_s');
  assert.ok(svg.indexOf('var(--_fg)') >= 0, kind + ' text reads --_fg');
});

console.log('ok design-pele-theme');
