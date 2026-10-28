// Vercel serverless：DSEDJ 招生簡章 PDF 代理
// 原檔帶 Content-Disposition: attachment（強制下載），此代理改成 inline 讓站內 iframe 可直接預覽。
// 用法: /api/brief?u_id=110042&fileName=對外经济贸易大学.pdf（2027）
//       /api/brief?year=2026&u_id=110040&fileName=清华大学.pdf（2026 參考）
export default async function handler(req, res) {
  const q = req.query;
  if (!q.u_id) { res.status(400).send('缺少 u_id'); return; }

  const params = new URLSearchParams();
  for (const k of ['year', 'u_id', 'fileName']) if (q[k]) params.set(k, q[k]);
  const upstream = `https://appl2.dsedj.gov.mo/ChinaUEnrollment/UPublic/DownloadUniDoc.jsp?${params}`;

  try {
    let r = null;
    for (let i = 0; i < 3; i++) {
      r = await fetch(upstream, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
          'Referer': 'https://appl2.dsedj.gov.mo/ChinaUEnrollment/UPublic/EnrollmentBrief.jsp',
        },
        redirect: 'follow',
      });
      const t = r.headers.get('content-type') || '';
      if (r.ok && !/html/i.test(t)) break;
      if (i < 2) await new Promise(res => setTimeout(res, 800 * (i + 1)));
    }
    const type = r.headers.get('content-type') || '';
    if (!r.ok || /html/i.test(type)) {
      res.status(502).send('簡章暫時無法載入（DSEDJ 未提供或連線失敗），請改用「直接下載」或稍後再試。');
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const fname = (q.fileName || 'brief.pdf') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fname)}`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).send('簡章暫時無法載入：' + e.message);
  }
}
