// 從 DSEDJ 保送生推薦系統抓取「保送高校名單及招生簡章」並解析
// 用法: node scripts/fetch-dsedj.mjs [輸出檔，預設 data/raw/dsedj-2027.json]
import fs from 'node:fs';

const OUT = process.argv[2] || 'data/raw/dsedj-2027.json';
const LIST_URL = 'https://appl2.dsedj.gov.mo/ChinaUEnrollment/UPublic/EnrollmentBrief.jsp';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

const res = await fetch(LIST_URL, { headers: { 'User-Agent': UA } });
if (!res.ok) { console.error('HTTP', res.status); process.exit(1); }
const src = await res.text();

const rows = [...src.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const unis = [];
for (const r of rows) {
  const cells = [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(m => stripTags(m[1]));
  if (cells.length < 8 || /序號/.test(cells[0])) continue;
  const [num, region, name, quota, exam, extra, brief2026cell, brief2027cell] = cells;
  const links = [...r.matchAll(/href="(DownloadUniDoc\.jsp\?[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
  const link26 = brief2026cell === '連結' ? links.shift() : null;
  const link27 = brief2027cell === '連結' ? links.shift() : null;
  const j = (u) => {
    if (!u) return null;
    const qs = new URLSearchParams(u.split('?')[1]);
    return {
      url: `https://appl2.dsedj.gov.mo/ChinaUEnrollment/UPublic/${u}`,
      u_id: qs.get('u_id'),
      fileName: qs.get('fileName') ? decodeURIComponent(qs.get('fileName')) : null,
    };
  };
  unis.push({
    seq: Number(num), region, nameS: name,
    quota: /^\d+$/.test(quota) ? Number(quota) : null,
    exam: exam && exam !== '' ? exam : null,
    extra: extra && extra !== '无' && extra !== '' ? extra : null,
    brief2026: j(link26), brief2027: j(link27),
    brief2026Status: brief2026cell, brief2027Status: brief2027cell,
  });
}

fs.mkdirSync('data/raw', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(unis, null, 2));
console.log(`OK: ${unis.length} 所高校 -> ${OUT}`);
console.log(`2027 簡章已上線: ${unis.filter(u => u.brief2027).length}`);
