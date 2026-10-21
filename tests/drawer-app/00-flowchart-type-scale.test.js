'use strict';
const assert = require('assert');
const Scale = require('../../packages/drawer-app/js/00-flowchart-type-scale.js');

assert.strictEqual(Scale.clampStep(0), 0);
assert.strictEqual(Scale.clampStep(1.4), 1);
assert.strictEqual(Scale.clampStep(-9), -3);
assert.strictEqual(Scale.clampStep(9), 3);
assert.strictEqual(Scale.clampStep('x'), 0);

assert.strictEqual(Scale.px('default', 0), 16);
assert.strictEqual(Scale.px('startEnd', 0), 15);
assert.strictEqual(Scale.px('judgment', 0), 14);
assert.strictEqual(Scale.px('link', 0), 13);

assert.strictEqual(Scale.px('default', 1), 18);
assert.strictEqual(Scale.px('startEnd', 1), 17);
assert.strictEqual(Scale.px('judgment', 1), 16);
assert.strictEqual(Scale.px('link', 1), 15);

assert.strictEqual(Scale.px('default', 2), 20);
assert.strictEqual(Scale.px('startEnd', 2), 19);
assert.strictEqual(Scale.px('judgment', 2), 18);
assert.strictEqual(Scale.px('link', 2), 16);

assert.strictEqual(Scale.px('default', 3), 23);
assert.strictEqual(Scale.px('startEnd', 3), 21);
assert.strictEqual(Scale.px('judgment', 3), 20);
assert.strictEqual(Scale.px('link', 3), 19);

assert.strictEqual(Scale.px('default', -1), 14);
assert.strictEqual(Scale.px('startEnd', -1), 13);
assert.strictEqual(Scale.px('judgment', -1), 12);
assert.strictEqual(Scale.px('link', -1), 12);

assert.strictEqual(Scale.px('default', -2), 13);
assert.strictEqual(Scale.px('startEnd', -2), 12);
assert.strictEqual(Scale.px('judgment', -2), 11);
assert.strictEqual(Scale.px('link', -2), 10);

assert.strictEqual(Scale.px('default', -3), 11);
assert.strictEqual(Scale.px('startEnd', -3), 11);
assert.strictEqual(Scale.px('judgment', -3), 10);
assert.strictEqual(Scale.px('link', -3), 9);

assert.ok(Scale.px('default', 0) > Scale.px('startEnd', 0));
assert.ok(Scale.px('startEnd', 0) > Scale.px('judgment', 0));
assert.ok(Scale.px('judgment', 0) > Scale.px('link', 0));
assert.ok(Scale.px('link', -3) >= Scale.MIN_PX);

function node(tag, cls, kids) {
  const el = {
    tagName: tag,
    className: cls || '',
    parentNode: null,
    style: {},
    attrs: cls ? { class: cls } : {},
    kids: kids || [],
    getAttribute(name) { return this.attrs[name] == null ? null : String(this.attrs[name]); },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => {
        const tagName = String(n.tagName || '').toLowerCase();
        if (sel === 'svg' && tagName === 'svg') out.push(n);
        if (sel === 'text, tspan' && (tagName === 'text' || tagName === 'tspan')) out.push(n);
        (n.kids || []).forEach(walk);
      };
      (this.kids || []).forEach(walk);
      if (sel === 'svg' && String(this.tagName || '').toLowerCase() === 'svg') out.unshift(this);
      if (sel === 'text, tspan') {
        const self = String(this.tagName || '').toLowerCase();
        if (self === 'text' || self === 'tspan') out.unshift(this);
      }
      return out;
    },
  };
  (el.kids || []).forEach((k) => { k.parentNode = el; });
  return el;
}

const defaultText = node('text', '', []);
const startText = node('text', '', []);
const judgeText = node('text', '', []);
const linkText = node('text', '', []);
const svg = node('svg', '', [
  node('g', 'pele-node pele-shape-rect', [defaultText]),
  node('g', 'pele-node pele-shape-stadium', [startText]),
  node('g', 'pele-node pele-shape-diam', [judgeText]),
  node('g', 'pele-edge-label', [linkText]),
]);

Scale.applyToRoot(svg, 0);
assert.strictEqual(defaultText.style.fontSize, '16px');
assert.strictEqual(startText.style.fontSize, '15px');
assert.strictEqual(judgeText.style.fontSize, '14px');
assert.strictEqual(linkText.style.fontSize, '13px');
assert.strictEqual(svg.getAttribute('data-fc-type-step'), '0');
assert.notStrictEqual(defaultText.style.fontSize, startText.style.fontSize);
assert.notStrictEqual(startText.style.fontSize, judgeText.style.fontSize);
assert.notStrictEqual(judgeText.style.fontSize, linkText.style.fontSize);

Scale.applyToRoot(svg, 2);
assert.strictEqual(defaultText.style.fontSize, '20px');
assert.strictEqual(startText.style.fontSize, '19px');
assert.strictEqual(judgeText.style.fontSize, '18px');
assert.strictEqual(linkText.style.fontSize, '16px');
assert.strictEqual(svg.getAttribute('data-fc-type-step'), '2');

console.log('ok flowchart-type-scale');
