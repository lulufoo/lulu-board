import { createRequire } from 'node:module';
import path from 'node:path';

export async function bundleDocumentFormat(repo) {
  const require = createRequire(path.join(repo, 'package.json'));
  const esbuild = require('esbuild');
  const result = await esbuild.build({
    absWorkingDir: repo,
    entryPoints: [path.join(repo, 'packages/board-core/document-format.js')],
    bundle: true,
    format: 'iife',
    globalName: 'BoardDocumentFormat',
    minify: true,
    write: false,
    target: 'es2018',
    footer: {
      js: 'var __D=BoardDocumentFormat;globalThis.DrawerDocumentMeta=__D;globalThis.splitDocument=__D.splitDocument;globalThis.joinDocument=__D.joinDocument;globalThis.stripDocumentMeta=__D.stripDocumentMeta;globalThis.sourceBody=__D.sourceBody;globalThis.newGraphId=__D.newGraphId;globalThis.blankHashBoardSource=__D.blankHashBoardSource;globalThis.diagramTitleFromBody=__D.diagramTitleFromBody;globalThis.updateMermaidTitle=__D.updateMermaidTitle;',
    },
  });
  return result.outputFiles[0].text;
}
