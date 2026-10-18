// A plain static file server: files only, no fallback page, real 404s. For looking at demos in a browser that will
// not open file:// pages, and for standing in for a host that serves a game from a folder.
//   node core/tools/serve.mjs <folder> [port]
// Every request is printed with its status.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [folder = '.', port = '4390'] = process.argv.slice(2);
const root = path.resolve(folder);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(root, decodeURIComponent(url.pathname));
  const done = (status, headers = {}, body = '') => { console.log(`${status} ${req.method} ${url.pathname}`); res.writeHead(status, headers); res.end(body); };
  if (!file.startsWith(root)) return done(403);
  let stat = fs.existsSync(file) ? fs.statSync(file) : null;
  if (stat?.isDirectory()) {
    if (!url.pathname.endsWith('/')) return done(301, { location: url.pathname + '/' + url.search });
    file = path.join(file, 'index.html');
    stat = fs.existsSync(file) ? fs.statSync(file) : null;
  }
  if (!stat) return done(404, { 'content-type': 'text/plain' }, 'Not found');
  done(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': stat.size, 'cache-control': 'no-store' }, fs.readFileSync(file));
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} on http://localhost:${port}`));
