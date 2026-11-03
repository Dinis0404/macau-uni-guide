// 從 DSEDJ 保送生推薦系統抓取「保送高校名單及招生簡章」並解析
// 兼容兩種版式：2026 起 8 欄（含 2026 參考欄）、2027 名單公佈期 7 欄（僅 2027 簡章欄）
// 用法: node scripts/fetch-dsedj.mjs [輸出檔，預設 data/raw/dsedj-2027.json]
import fs from 'node:fs';

const OUT = process.argv[2] || 'data/raw/dsedj-2027.json';
const LIST_URL = 'https://appl2.dsedj.gov.mo/ChinaUEnrollment/UPublic/EnrollmentBrief.jsp';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

let src = null;
for (let i = 0; i < 3; i++) {
  try {
    const res = await fetch(LIST_URL, { headers: { 'User-Agent': UA } });
    const t = await res.text();
    if (res.ok && /DownloadUniDoc|高校名稱/.test(t)) { src = t; break; }
    console.warn(`retry ${i + 1}: HTTP ${res.status}`);
  } catch (e) { console.warn(`retry ${i + 1}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 2000 * (i + 1)));
}
if (!src) { console.error('名單頁抓取失敗，保留舊檔'); process.exit(1); }

const rows = [...src.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const unis = [];
for (const r of rows) {
  const cells = [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(m => stripTags(m[1]));
  if (cells.length < 7 || /序號/.test(cells[0])) continue;
  const [num, region, name, quota, exam, extra] = cells;
  const linkCells = cells.filter(c => c === '連結');
  const links = [...r.matchAll(/href="(DownloadUniDoc\.jsp\?[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
  // 新 7 欄版式：唯一連結欄即 2027 簡章；舊 8 欄版式：第 1 個連結=2026、第 2 個=2027
  let link26 = null, link27 = null;
  if (cells.length >= 8) { link26 = linkCells[0] === '連結' ? links.shift() : null; link27 = linkCells[1] === '連結' ? links.shift() : null; }
  else { link27 = linkCells[0] === '連結' ? links.shift() : null; }
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
  });
}

if (unis.length < 50) { console.error(`解析出 ${unis.length} 所（異常，應 >100），保留舊檔不覆蓋`); process.exit(1); }
fs.mkdirSync('data/raw', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(unis, null, 2));
console.log(`OK: ${unis.length} 所高校 -> ${OUT}`);
console.log(`2027 簡章已上線: ${unis.filter(u => u.brief2027).length}`);
console.log(`含 2026 參考欄: ${unis.filter(u => u.brief2026).length}`);
