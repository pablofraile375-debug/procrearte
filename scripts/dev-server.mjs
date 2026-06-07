import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url || '/index.html';
  const clean = normalize(url.split('?')[0]).replace(/^\.\.(\/|\\|$)/, '');
  const candidates = [join(root, clean), join(root, 'dist', clean)];
  for (const file of candidates) {
    try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(body); return; } catch {}
  }
  res.writeHead(404); res.end('Not found');
}).listen(4173, '0.0.0.0', () => console.log('Procrearte running on http://0.0.0.0:4173'));
