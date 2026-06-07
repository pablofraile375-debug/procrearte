import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.argv[2] || 'dist';
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url || '/index.html';
  const clean = normalize(url.split('?')[0]).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = join(root, clean);
  try {
    const body = await readFile(file);
    const extension = extname(file);
    res.writeHead(200, {
      'content-type': types[extension] || 'application/octet-stream',
      'cache-control': extension === '.svg' ? 'public, max-age=3600' : 'no-store'
    });
    res.end(body);
  } catch {
    if (clean !== '/index.html') {
      try {
        const body = await readFile(join(root, 'index.html'));
        res.writeHead(200, { 'content-type': types['.html'], 'cache-control': 'no-store' });
        res.end(body);
        return;
      } catch {
        // fall through to 404
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`Not found: ${clean}`);
  }
}).listen(4173, '0.0.0.0', () => console.log(`Procrearte running on http://0.0.0.0:4173 from ${root}`));
