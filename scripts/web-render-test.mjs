#!/usr/bin/env node
/**
 * Developer-only local viewer for rendering a built web board.
 *
 * It never serves on a public interface: the listener is bound to 127.0.0.1.
 * Pass --board to put a BMD file in the viewer's #z: fragment.
 */
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(repo, 'web');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function usage() {
  return [
    'Usage: node scripts/web-render-test.mjs [options]',
    '',
    'Serve the built web viewer on 127.0.0.1 for manual rendering checks.',
    '',
    'Options:',
    '  --board <file>  Encode a BMD file into the viewer URL fragment.',
    '  --port <port>   TCP port (default: 0, chooses an available port).',
    '  --no-open       Print the URL without opening the system browser.',
    '  --help          Show this help.',
  ].join('\n');
}

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
}

function parseArgs(args) {
  const options = { board: '', open: true, port: 0 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help') return { help: true };
    if (arg === '--no-open') {
      options.open = false;
      continue;
    }
    if (arg === '--board' || arg === '--port') {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      if (arg === '--board') options.board = path.resolve(value);
      else {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be an integer from 0 to 65535');
        options.port = port;
      }
      continue;
    }
    throw new Error(`unknown option '${arg}'`);
  }
  return options;
}

function encodeBoardHash(file) {
  const source = readFileSync(file);
  return deflateSync(source)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function pathForRequest(rawUrl) {
  const pathname = new URL(rawUrl || '/', 'http://127.0.0.1').pathname;
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(webRoot, relative);
  const fromRoot = path.relative(webRoot, candidate);
  if (fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  return candidate;
}

function serveFile(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  let file;
  try {
    file = pathForRequest(req.url);
  } catch (_) {
    res.writeHead(400);
    res.end();
    return;
  }
  if (!file) {
    res.writeHead(403);
    res.end();
    return;
  }
  let stat;
  try {
    stat = statSync(file);
  } catch (_) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (!stat.isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  const contentType = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': stat.size,
    'Content-Type': contentType,
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}

function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'linux' ? 'xdg-open' : '';
  if (!command) return;
  const child = spawn(command, [url], { detached: true, stdio: 'ignore' });
  child.unref();
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    process.stderr.write(`${usage()}\n`);
    return;
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  let boardHash = '';
  try {
    const stat = statSync(webRoot);
    if (!stat.isDirectory()) throw new Error('web/ is missing; run node scripts/web-build/build.mjs first');
    if (options.board) {
      if (!statSync(options.board).isFile()) throw new Error(`--board must be a file: ${options.board}`);
      boardHash = encodeBoardHash(options.board);
    }
  } catch (error) {
    fail(error.message);
    return;
  }

  const server = createServer(serveFile);
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port, '127.0.0.1', resolve);
    });
  } catch (error) {
    fail(error.message);
    return;
  }
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : options.port;
  const hash = boardHash ? `#z:${boardHash}` : '';
  const url = `http://127.0.0.1:${port}/${hash}`;
  process.stdout.write(`ready ${url}\n`);
  if (options.open) openBrowser(url);

  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

await main();
