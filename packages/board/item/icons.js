/* Adapter for the author icon catalog and renderer path map. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BoardIcons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function wrap(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  function loadJSON(globalName, label, candidates) {
    if (root[globalName]) return root[globalName];
    if (typeof require === 'function' && typeof __dirname === 'string') {
      const fs = require('fs');
      for (let i = 0; i < candidates.length; i += 1) {
        if (fs.existsSync(candidates[i])) {
          return JSON.parse(fs.readFileSync(candidates[i], 'utf8'));
        }
      }
    }
    throw new Error(`Board ${label} missing`);
  }

  function loadCatalog() {
    const path = typeof require === 'function' ? require('path') : null;
    return loadJSON('BoardIconsCatalog', 'icon catalog', path ? [
      path.join(__dirname, '..', '..', '..', 'skill', 'board', 'common', 'icons.json')
    ] : []);
  }

  function loadPaths() {
    const path = typeof require === 'function' ? require('path') : null;
    return loadJSON('BoardIconPaths', 'icon path map', path ? [
      path.join(__dirname, 'icon-paths.json')
    ] : []);
  }

  const catalog = loadCatalog();
  const paths = loadPaths();
  const GLOSS = {};
  const SECTION_OF = {};
  const sections = (catalog.sections || []).map(function (section) {
    if (!section || !section.id || !Array.isArray(section.icons)) {
      throw new Error('Board icon catalog has an invalid section');
    }
    const icons = section.icons.map(function (icon) {
      const n = Number(icon && icon.n);
      if (!Number.isInteger(n) || !icon.gloss || !paths[n] || GLOSS[n]) {
        throw new Error('Board icon catalog and path map disagree');
      }
      GLOSS[n] = icon.gloss;
      SECTION_OF[n] = section.id;
      return n;
    });
    return { id: section.id, label: section.label, digit: section.digit, icons: icons };
  });
  const numbers = Object.keys(GLOSS).map(Number);

  function glyph(n) {
    const iconPath = paths[Number(n)];
    return iconPath ? wrap(iconPath) : null;
  }

  function sectionOf(n) {
    const section = SECTION_OF[Number(n)];
    if (section) return section;
    const first = sections[0];
    return first && first.id ? first.id : "shapes";
  }

  return {
    glyph: glyph,
    gloss: GLOSS,
    sections: sections,
    sectionOf: sectionOf,
    MIN: numbers.length ? Math.min.apply(null, numbers) : null,
    MAX: numbers.length ? Math.max.apply(null, numbers) : null
  };
});
