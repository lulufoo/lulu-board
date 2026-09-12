import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import Ajv2019 from 'ajv/dist/2019.js';
import { JSON_SCHEMA, load } from 'js-yaml';

const DIAGRAM_KEYS = [
  'flowchart',
  'sequence',
  'gantt',
  'journey',
  'class',
  'state',
  'er',
  'pie',
  'quadrantChart',
  'xyChart',
  'requirement',
  'mindmap',
  'kanban',
  'timeline',
  'gitGraph',
  'c4',
  'sankey',
  'block',
  'packet',
  'architecture',
  'radar',
];

function generateDefaults(schema) {
  const ajv = new Ajv2019({ useDefaults: true, allowUnionTypes: true, strict: true });
  ajv.addKeyword({ keyword: 'meta:enum', errors: false });
  ajv.addKeyword({ keyword: 'tsType', errors: false });
  const defaults = {};
  assert.ok(schema.$defs);
  const base = schema.$defs.BaseDiagramConfig;
  for (const key of DIAGRAM_KEYS) {
    const ref = schema.properties[key].$ref;
    const [, defs, defName] = ref.split('/');
    assert.strictEqual(defs, '$defs');
    const sub = { $schema: schema.$schema, $defs: schema.$defs, ...schema.$defs[defName] };
    const validate = ajv.compile(sub);
    defaults[key] = {};
    for (const required of sub.required ?? []) {
      if (sub.properties[required] === undefined && base.properties[required]) {
        defaults[key][required] = base.properties[required].default;
      }
    }
    if (!validate(defaults[key])) {
      throw new Error(`schema defaults invalid for ${key}: ${JSON.stringify(validate.errors)}`);
    }
  }
  const validate = ajv.compile(schema);
  if (!validate(defaults)) {
    throw new Error(`Mermaid config defaults invalid: ${JSON.stringify(validate.errors)}`);
  }
  return defaults;
}

export const jsonSchemaPlugin = {
  name: 'json-schema-plugin',
  setup(build) {
    build.onLoad({ filter: /config\.schema\.yaml$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      const schema = load(source, { filename: args.path, schema: JSON_SCHEMA });
      const value = args.suffix.includes('only-defaults')
        ? generateDefaults(schema)
        : schema;
      return { contents: `export default ${JSON.stringify(value)};`, loader: 'js' };
    });
  },
};
