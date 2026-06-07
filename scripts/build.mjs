import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('src/styles', 'dist/assets/styles', { recursive: true });
let html = await readFile('index.html', 'utf8');
html = html.replace('/src/main.ts', '/assets/main.js');
await writeFile('dist/index.html', html);
