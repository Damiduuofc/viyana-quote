// Local server for your computer (Vercel uses public/ + api/ instead): serves public/ and POST /api/parse. No dependencies.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOrder, checkPassword } from './lib/parse.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, 'public');

// Load .env (simple KEY=value lines) without overriding real env vars
if (existsSync(path.join(root, '.env'))) {
  for (const line of readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 100000) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/parse') {
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    if (!checkPassword(req.headers['x-app-password'])) {
      res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Wrong password' }));
      return;
    }
    try {
      const { text } = JSON.parse((await readBody(req)) || '{}');
      const data = await parseOrder(text);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  // Static files from public/ only
  const file = path.normalize(path.join(pub, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(pub + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(buf);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

// Safari reuses idle connections longer than Node's 5s default and then fails POSTs with
// "Load failed", so keep idle connections open longer.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Viyana Quotation Maker running on http://localhost:${port}`));
