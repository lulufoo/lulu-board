#!/usr/bin/env node
/**
 * App vendor build: boxes, mermaid-ext, drawer, supabase/sentry clients.
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function run(name) {
  const result = spawnSync(process.execPath, [path.join(here, name)], { stdio: 'inherit' });
  if (result.status) process.exit(result.status || 1);
}

run('boxes.mjs');
run('drawer.mjs');
