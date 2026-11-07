// 依存ゼロの静的ファイルサーバ。port 5173 から、使用中なら +1 して探す。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START_PORT = Number(process.env.PORT) || 5173;
const MAX_TRIES = 20;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function handler(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }).end(data);
  });
}

export function startServer(port = START_PORT, tries = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && tries < MAX_TRIES) {
        resolve(startServer(port + 1, tries + 1));
      } else {
        reject(err);
      }
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, port }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { port } = await startServer();
  console.log(`Tag Dash: http://localhost:${port}/`);
}
