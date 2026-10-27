import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');

const FORBID = {
  core: new Set(['state', 'kinds', 'export', 'cloud', 'chrome']),
  state: new Set(['kinds', 'export', 'cloud', 'chrome']),
  kinds: new Set(['export', 'cloud', 'chrome']),
  export: new Set(['cloud', 'chrome']),
  cloud: new Set(['export', 'chrome']),
  chrome: new Set(),
};

const IMPORT_RE = /import\s+(?:(?<def>\w+)\s*,\s*)?(?:(?<star>\*\s+as\s+(?<ns>\w+))|(?<named>\{[\s\S]*?\})|(?<onlydef>\w+))\s+from\s+(?<q>['"])(?<spec>[^'"]+)\k<q>\s*;/g;
const SIDE_RE = /import\s+(['"])([^'"]+)\1\s*;/g;
const EXPORT_FROM_RE = /export\s+(?:\*|(?:\{[\s\S]*?\}))\s+from\s+(['"])([^'"]+)\1\s*;/g;

function stripNoise(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const peek = (k = 0) => (i + k < n ? src[i + k] : '');
  let prevCode = '';
  const lastCode = () => {
    for (let k = prevCode.length - 1; k >= 0; k -= 1) {
      if (!/\s/.test(prevCode[k])) return prevCode[k];
    }
    return '';
  };
  const regexOkPrev = () => {
    const ch = lastCode();
    if (!ch) return true;
    if (/[\w$)\]]/.test(ch)) return false;
    return true;
  };
  while (i < n) {
    const c = src[i];
    const nxt = peek(1);
    if (c === '/' && nxt === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && nxt === '*') {
      i += 2;
      while (i + 1 < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === '/' && regexOkPrev()) {
      i += 1;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') {
          i += 1;
          while (i < n && src[i] !== ']') {
            if (src[i] === '\\') i += 2;
            else i += 1;
          }
          i += 1;
          continue;
        }
        if (src[i] === '/') {
          i += 1;
          while (i < n && /[a-z]/i.test(src[i])) i += 1;
          break;
        }
        i += 1;
      }
      out += "''";
      prevCode += "''";
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i += 1;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) { i += 1; break; }
        i += 1;
      }
      out += "''";
      prevCode += "''";
      continue;
    }
    if (c === '`') {
      i += 1;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '`') { i += 1; break; }
        if (src[i] === '$' && peek(1) === '{') {
          i += 2;
          let depth = 1;
          const start = i;
          while (i < n && depth) {
            if (src[i] === '{') depth += 1;
            else if (src[i] === '}') depth -= 1;
            if (depth) i += 1;
            else break;
          }
          out += stripNoise(src.slice(start, i));
          if (src[i] === '}') i += 1;
          continue;
        }
        i += 1;
      }
      out += "''";
      prevCode += "''";
      continue;
    }
    out += c;
    prevCode += c;
    i += 1;
  }
  return out;
}

// A use is a bare identifier: not part of a longer word, and not a property name
// (`x.call(...)`, `a?.call`). `...call` is a spread, so it still counts.
const NOT_PROPERTY = '(?<!(?:^|[^.])\\.)';
function identCount(name, text) {
  if (name === '$') return (text.match(new RegExp(`(?<![\\w$])${NOT_PROPERTY}\\$(?![\\w$])`, 'g')) || []).length;
  const re = new RegExp(`(?<![\\w$])${NOT_PROPERTY}${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?![\\w$])`, 'g');
  return (text.match(re) || []).length;
}

function parseNamed(block) {
  const inner = block.trim().slice(1, -1);
  const items = [];
  for (const part of inner.split(',')) {
    const bit = part.trim();
    if (!bit) continue;
    if (bit.includes(' as ')) {
      const [exported, local] = bit.split(/\s+as\s+/);
      items.push({ exported: exported.trim(), local: local.trim() });
    } else {
      items.push({ exported: bit, local: bit });
    }
  }
  return items;
}

function importBindings(stmt) {
  IMPORT_RE.lastIndex = 0;
  const m = IMPORT_RE.exec(stmt);
  if (!m || !m.groups) return [];
  const names = [];
  if (m.groups.def) names.push(m.groups.def);
  if (m.groups.onlydef) names.push(m.groups.onlydef);
  if (m.groups.ns) names.push(m.groups.ns);
  if (m.groups.named) names.push(...parseNamed(m.groups.named).map((x) => x.local));
  return names;
}

function findImportStmts(text) {
  const spans = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(text))) spans.push({ start: m.index, end: m.index + m[0].length, stmt: m[0], spec: m.groups.spec });
  return spans;
}

function maskSpans(text, spans) {
  let masked = text;
  for (const span of spans.slice().reverse()) {
    masked = masked.slice(0, span.start) + ' '.repeat(span.end - span.start) + masked.slice(span.end);
  }
  return masked;
}

function layerOf(rel) {
  const parts = rel.split('/');
  if (parts[0] === 'packages' && parts[1] === 'drawer-app' && parts[2] === 'src' && FORBID[parts[3]]) return parts[3];
  return 'other';
}

function resolveSpec(fromRel, spec) {
  if (!spec.startsWith('.')) return null;
  const dir = path.posix.dirname(fromRel);
  let target = path.posix.normalize(path.posix.join(dir, spec));
  if (!target.endsWith('.js')) target += '.js';
  return target;
}

function walkJs(dir, relBase, out) {
  for (const name of fs.readdirSync(dir).sort()) {
    if (name === 'node_modules' || name === 'dist' || name === '.cache') continue;
    const full = path.join(dir, name);
    const rel = path.posix.join(relBase, name);
    if (fs.statSync(full).isDirectory()) walkJs(full, rel, out);
    else if (name.endsWith('.js')) out[rel] = fs.readFileSync(full, 'utf8');
  }
}

function unusedImports(files) {
  const violations = [];
  for (const [rel, text] of Object.entries(files)) {
    const spans = findImportStmts(text);
    if (!spans.length) continue;
    const usage = stripNoise(maskSpans(text, spans));
    for (const span of spans) {
      for (const name of importBindings(span.stmt)) {
        if (!identCount(name, usage)) violations.push({ file: rel, name });
      }
    }
  }
  return violations;
}

function hookMaps(files) {
  const registers = {};
  const callers = {};
  const dynamic = [];
  for (const [rel, text] of Object.entries(files)) {
    const reReg = /\bregister\(\s*["']([^"']+)["']/g;
    let m;
    while ((m = reReg.exec(text))) registers[m[1]] = rel;
    const reCall = /\b(call|emit)\(\s*["']([^"']+)["']/g;
    while ((m = reCall.exec(text))) {
      (callers[m[2]] || (callers[m[2]] = [])).push(rel);
    }
    const reDyn = /(?<!\.)\b(call|emit)\(\s*([^"'\s)])/g;
    while ((m = reDyn.exec(text))) {
      if (rel.endsWith('core/hooks.js')) continue;
      dynamic.push({ file: rel, snippet: m[0] });
    }
  }
  return { registers, callers, dynamic };
}

function importGraph(files) {
  const graph = {};
  for (const [rel, text] of Object.entries(files)) {
    graph[rel] = new Set();
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(text))) {
      const target = resolveSpec(rel, m.groups.spec);
      if (target && files[target]) graph[rel].add(target);
    }
    SIDE_RE.lastIndex = 0;
    while ((m = SIDE_RE.exec(text))) {
      const target = resolveSpec(rel, m[2]);
      if (target && files[target]) graph[rel].add(target);
    }
    EXPORT_FROM_RE.lastIndex = 0;
    while ((m = EXPORT_FROM_RE.exec(text))) {
      const target = resolveSpec(rel, m[2]);
      if (target && files[target]) graph[rel].add(target);
    }
  }
  return graph;
}

function reaches(graph, from, to) {
  const seen = new Set();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const n of graph[cur] || []) stack.push(n);
  }
  return false;
}

function registerViolations(files) {
  const { registers, callers, dynamic } = hookMaps(files);
  const graph = importGraph(files);
  const unused = [];
  const directable = [];
  const orphan = [];
  for (const [name, defRel] of Object.entries(registers)) {
    if (!defRel.includes('/cloud/')) continue;
    const cs = callers[name] || [];
    if (!cs.length) {
      unused.push({ name, file: defRel });
      continue;
    }
    const defLayer = layerOf(defRel);
    let allDirect = true;
    let onlySelf = true;
    for (const caller of cs) {
      if (caller === defRel) continue;
      onlySelf = false;
      const cl = layerOf(caller);
      if (FORBID[cl] && FORBID[cl].has(defLayer)) { allDirect = false; break; }
      if (reaches(graph, defRel, caller)) { allDirect = false; break; }
    }
    if (onlySelf || allDirect) directable.push({ name, file: defRel, onlySelf });
  }
  for (const [name, cs] of Object.entries(callers)) {
    if (!registers[name]) orphan.push({ name, files: cs });
  }
  return { unused, directable, orphan, dynamic };
}

function loadPackages() {
  const files = {};
  walkJs(path.join(root, 'packages'), 'packages', files);
  return files;
}

function loadSrc(files) {
  const src = {};
  for (const [rel, text] of Object.entries(files)) {
    if (rel.startsWith('packages/drawer-app/src/')) src[rel] = text;
  }
  return src;
}

// --- fixtures: each must fail one rule ---
function fixtureUnusedImport() {
  return {
    'packages/mermaid-ext/fixture-unused.js': 'import { missingName } from "./kinds.js";\nexport function x() { return 1; }\n',
  };
}
function fixturePropertyOnlyImport() {
  return {
    'packages/mermaid-ext/fixture-property.js': 'import { call } from "../drawer-app/src/core/hooks.js";\nexport function x(list) { return Array.prototype.map.call(list, String); }\n',
  };
}
function fixtureSpreadUse() {
  return {
    'packages/mermaid-ext/fixture-spread.js': 'import { rest } from "./kinds.js";\nexport const x = [...rest];\n',
  };
}
function fixtureUnusedRegister() {
  return {
    'packages/drawer-app/src/core/hooks.js': 'export function register() {}\nexport function call() {}\nexport function emit() {}\n',
    'packages/drawer-app/src/cloud/fixture-unused-reg.js': 'import { register } from "../core/hooks.js";\nfunction ghost() {}\nregister("ghost", ghost);\n',
  };
}
function fixtureDirectableRegister() {
  return {
    'packages/drawer-app/src/core/hooks.js': 'export function register() {}\nexport function call() {}\nexport function emit() {}\n',
    'packages/drawer-app/src/cloud/leaf.js': 'export function leafFn() { return 1; }\n',
    'packages/drawer-app/src/cloud/peer.js': 'import { register } from "../core/hooks.js";\nimport { call } from "../core/hooks.js";\nfunction peerFn() {}\nregister("peerFn", peerFn);\ncall("leafFn");\n',
    'packages/drawer-app/src/cloud/user.js': 'import { call } from "../core/hooks.js";\ncall("peerFn");\n',
  };
}
function fixtureOrphanCall() {
  return {
    'packages/drawer-app/src/cloud/orphan.js': 'import { call } from "../core/hooks.js";\ncall("doesNotExist");\n',
  };
}

const real = loadPackages();
const unused = unusedImports(real);
assert.deepStrictEqual(unused, [], 'packages/ has unused imports:\n' + unused.map((v) => '  ' + v.file + ' ' + v.name).join('\n'));

const hooks = registerViolations(loadSrc(real));
assert.deepStrictEqual(hooks.unused, [], 'cloud unused register:\n' + hooks.unused.map((v) => '  ' + v.name).join('\n'));
assert.deepStrictEqual(hooks.directable, [], 'cloud register that can be a direct import:\n' + hooks.directable.map((v) => '  ' + v.name).join('\n'));
assert.deepStrictEqual(hooks.orphan, [], 'call/emit without register:\n' + hooks.orphan.map((v) => '  ' + v.name).join('\n'));
assert.deepStrictEqual(hooks.dynamic, [], 'dynamic call/emit name:\n' + hooks.dynamic.map((v) => '  ' + v.file + ' ' + v.snippet).join('\n'));

assert.ok(unusedImports(fixtureUnusedImport()).length, 'unused import fixture must fail');
assert.ok(unusedImports(fixturePropertyOnlyImport()).length, 'import used only as a property name (.call) must fail');
assert.strictEqual(unusedImports(fixtureSpreadUse()).length, 0, 'spread use (...rest) must count as a use');
assert.ok(registerViolations(fixtureUnusedRegister()).unused.length, 'unused register fixture must fail');
assert.ok(registerViolations(fixtureDirectableRegister()).directable.length, 'directable register fixture must fail');
assert.ok(registerViolations(fixtureOrphanCall()).orphan.length, 'orphan call fixture must fail');

console.log('ok imports-hooks');
console.log('packages files', Object.keys(real).length);
console.log('cloud registers kept', Object.entries(hookMaps(loadSrc(real)).registers).filter(([, f]) => f.includes('/cloud/')).length);
