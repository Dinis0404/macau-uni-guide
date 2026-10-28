// 本地預覽伺服器：node scripts/dev-server.mjs [端口]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv[2]) || 8080;
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

// 本地版簡章代理：與 api/brief.js 同邏輯（Vercel 上用 serverless 版）
async function briefProxy(req, res, url) {
  const q = url.searchParams;
  if (!q.get('u_id')) { res.writeHead(400).end('缺少 u_id'); return; }
  const params = new URLSearchParams();
  for (const k of ['year', 'u_id', 'fileName']) if (q.get(k)) params.set(k, q.get(k));
  try {
    let r = null;
    for (let i = 0; i < 3; i++) {
      r = await fetch(`https://appl2.dsedj.gov.mo/ChinaUEnrollment/UPublic/DownloadUniDoc.jsp?${params}`, {
        headers: { 'User-Agent': UA, Referer: 'https://appl2.dsedj.gov.mo/ChinaUEnrollment/UPublic/EnrollmentBrief.jsp' },
        redirect: 'follow',
      });
      const t = r.headers.get('content-type') || '';
      if (r.ok && !/html/i.test(t)) break;
      if (i < 2) await new Promise(res => setTimeout(res, 800 * (i + 1)));
    }
    const type = r.headers.get('content-type') || '';
    if (!r.ok || /html/i.test(type)) { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('簡章暫時無法載入，請改用「直接下載」。'); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent((q.get('fileName') || 'brief') + '.pdf')}`,
      'Cache-Control': 'public, max-age=86400',
    });
    res.end(buf);
  } catch (e) { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('代理失敗：' + e.message); }
}

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/brief') return briefProxy(req, res, new URL(req.url, 'http://x'));
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`預覽：http://localhost:${PORT}`));
