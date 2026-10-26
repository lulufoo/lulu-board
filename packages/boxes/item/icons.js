/* Adapter for the author icon catalog and renderer path map. */
import catalog from '../skill-assets/icons.json' with { type: 'json' };
import paths from './icon-paths.json' with { type: 'json' };

function wrap(inner) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}

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

const Icons = {
  glyph: glyph,
  gloss: GLOSS,
  sections: sections,
  sectionOf: sectionOf,
  MIN: numbers.length ? Math.min.apply(null, numbers) : null,
  MAX: numbers.length ? Math.max.apply(null, numbers) : null
};
export default Icons;
