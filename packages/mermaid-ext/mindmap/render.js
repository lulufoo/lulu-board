import { parseMindmap } from "./parse.js";
import { measureTree } from "./measure.js";
import { layoutRadial } from "./layout/radial.js";
import { layoutLogic } from "./layout/logic.js";
import { drawSvg } from "./draw.js";
import { normalizeTheme } from "./themes.js";

const LAYOUTS = {
  radial: layoutRadial,
  logic: layoutLogic,
};

export function normalizeLayout(name) {
  const n = String(name || "radial").toLowerCase();
  return n === "logic" ? "logic" : "radial";
}

export function render(source, options) {
  options = options || {};
  const layout = normalizeLayout(options.layout);
  const { root, errors } = parseMindmap(source);
  if (!root) {
    return { svg: "", layout, errors: errors.length ? errors : ["Empty mindmap"], model: null };
  }
  const tree = JSON.parse(JSON.stringify(root));
  measureTree(tree);
  const layouter = LAYOUTS[layout] || layoutRadial;
  const model = layouter(tree, options.layoutOpts || {});
  const theme = normalizeTheme(options.theme);
  const svg = drawSvg(model, { id: options.id || "mm_" + Date.now(), theme: theme });
  return { svg, layout, theme, errors, model };
}

