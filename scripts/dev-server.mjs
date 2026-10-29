// 로컬 확인용: dist 정적 파일 + api/ 함수를 Vercel과 같은 경로로 띄운다.
// DATABASE_URL이 없으면 메모리 PGlite를 Postgres 프로토콜로 함께 띄운다.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT || 4180);
process.env.T08_ORIGIN ||= `http://localhost:${port}`;

if (!process.env.DATABASE_URL) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const db = await PGlite.create();
  const dbPort = Number(process.env.DEV_DB_PORT || 5433);
  await new PGLiteSocketServer({ db, port: dbPort, host: '127.0.0.1' }).start();
  process.env.DATABASE_URL = `postgres://postgres@127.0.0.1:${dbPort}/postgres?sslmode=disable`;
  process.env.PG_POOL_MAX ||= '1';
  console.log(`[dev] 메모리 PGlite → 127.0.0.1:${dbPort}`);
}

// vercel.json의 보안 헤더를 로컬에서도 같이 붙여 CSP 위반을 미리 잡는다.
const vercelHeaders = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8')).headers[0].headers;

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json',
};

async function apiHandler(pathname) {
  const base = join(root, normalize(pathname).replace(/^\/+/, ''));
  for (const file of [`${base}.js`, join(base, 'index.js')]) {
    try {
      await stat(file);
    } catch {
      continue;
    }
    return (await import(pathToFileURL(file).href)).default; // 문법 오류는 숨기지 않고 그대로 드러낸다
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith('/api/')) {
    const handler = await apiHandler(url.pathname);
    if (!handler) {
      res.writeHead(404).end('not found');
      return;
    }
    await handler(req, res);
    return;
  }
  const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, 'dist', rel));
    for (const { key, value } of vercelHeaders) res.setHeader(key, value);
    res.writeHead(200, { 'Content-Type': types[extname(rel)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`[dev] ${process.env.T08_ORIGIN}`));
