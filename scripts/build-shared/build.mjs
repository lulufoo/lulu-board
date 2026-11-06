#!/usr/bin/env node
/**
 * Shared vendor build: Supabase and Sentry clients plus their runtime configuration.
 * packages/board-app/shared/vendor → .cache/web/vendor/.
 * workspace, landing and oauth load the outputs as shipped scripts; none of them imports shared.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const srcDir = path.join(repo, 'packages', 'board-app', 'shared', 'vendor');
const vendorOut = path.join(repo, '.cache/web/vendor');
mkdirSync(vendorOut, { recursive: true });

const require = createRequire(path.join(repo, 'package.json'));
const esbuild = require('esbuild');

async function bundleClient(name) {
  const built = await esbuild.build({
    absWorkingDir: repo,
    entryPoints: [path.join(srcDir, name)],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    write: false,
    // packages/tsconfig.json has strict: true, which makes esbuild prepend "use strict" to
    // files under packages/. These are third-party bundles; keep them as they were built before.
    tsconfigRaw: '{}',
  });
  const text = built.outputFiles[0].text;
  writeFileSync(path.join(vendorOut, name), text);
  console.log(`ok ${name} (${text.length} bytes)`);
}

const config = {
  url: String(process.env.LULU_BOARD_SUPABASE_URL || 'https://xjwlxxuafhsfzksxxmtu.supabase.co').trim(),
  publishableKey: String(process.env.LULU_BOARD_SUPABASE_PUBLISHABLE_KEY || '').trim(),
};
writeFileSync(
  path.join(vendorOut, 'supabase-config.js'),
  'window.LuluBoardSupabaseConfig = Object.freeze(' + JSON.stringify(config) + ');\n'
);
await bundleClient('supabase-client.js');

const sentry = {
  dsn: String(process.env.LULU_BOARD_SENTRY_DSN || '').trim(),
};
writeFileSync(
  path.join(vendorOut, 'sentry-config.js'),
  'window.LuluBoardSentryConfig = Object.freeze(' + JSON.stringify(sentry) + ');\n'
);
await bundleClient('sentry-client.js');
