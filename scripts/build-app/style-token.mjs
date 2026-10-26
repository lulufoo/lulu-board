import { createRequire } from 'node:module';
import path from 'node:path';

export async function bundleStyleToken(repo) {
  const require = createRequire(path.join(repo, 'package.json'));
  const esbuild = require('esbuild');
  const result = await esbuild.build({
    absWorkingDir: repo,
    entryPoints: [path.join(repo, 'packages/board-core/style-token.js')],
    bundle: true,
    format: 'iife',
    globalName: 'BoardStyleToken',
    minify: true,
    write: false,
    target: 'es2018',
  });
  return result.outputFiles[0].text;
}
