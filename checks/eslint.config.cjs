// ESLint flat config for checks/lint.mjs. One rule on purpose: no-undef.
//
// Why: an identifier used in a file that neither declares it nor imports it only fails when
// that line runs. esbuild bundles it without a word, and dependency-cruiser looks at import
// edges, not at names (the #137 incident). no-undef resolves each name inside its own module.
//
// no-unused-vars is off: it cannot be limited to imports, and 14 unused locals exist today.
// Unused imports are checked by checks/drawer-app/07-imports-hooks.test.js.
//
// typeof: true makes `typeof name` count as a use, so a guard cannot hide a missing import.
const globals = require('globals');

module.exports = [
  { ignores: ['**/third_party/**', '**/.cache/**', '**/node_modules/**'] },
  {
    files: ['packages/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: { 'no-undef': ['error', { typeof: true }] },
  },
  {
    // Browser first, Node as the fallback: `typeof Buffer !== 'undefined'` is feature detection.
    files: [
      'packages/board-core/document-format.js',
      'packages/board-core/style-token.js',
      'packages/drawer-app/src/core/hash-persist.js',
      'packages/drawer-app/src/core/style-line.js',
    ],
    languageOptions: { globals: { Buffer: 'readonly' } },
  },
  {
    // Also loaded by Node tests: `typeof module === 'object' && module.exports`.
    files: ['packages/site/oauth/consent/consent.js'],
    languageOptions: { globals: { module: 'readonly' } },
  },
];
