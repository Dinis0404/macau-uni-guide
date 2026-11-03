// 從 DSEDJ「查詢內地高校招生專業」抓取每所高校的保送專業列表
// 用法: node scripts/fetch-majors.mjs
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const URL = 'https://appl2.dsedj.gov.mo/ChinaUEnrollment/UPublic/ShowSearchMajor.jsp';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const unis = JSON.parse(fs.readFileSync('data/raw/dsedj-2027.json', 'utf-8'));
const result = readExisting();
function readExisting() {
  try { return JSON.parse(fs.readFileSync('data/raw/majors-2027.json', 'utf-8')); } catch { return {}; }
}
let ok = 0, empty = 0, kept = 0;

for (const u of unis) {
  const body = new URLSearchParams({
    type: 'SearchByUniversity',
    UniversityName: u.nameS,
    InputMajor: '',
    EnrollmentSection: 'First',
    IsEngTeach: '',
  });
  let majors = [];
  for (let i = 0; i < 3 && majors.length === 0; i++) {
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const html = await res.text();
      const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)];
      for (const r of rows) {
        const cells = [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
          .map(c => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
        if (cells.length >= 3 && /^\d+\.$/.test(cells[0])) majors.push(cells[2]);
      }
      if (majors.length === 0 && i < 2) await sleep(1500 * (i + 1)); // 可能被限流，重試
    } catch (e) {
      console.error(`\n${u.nameS} 失敗: ${e.message}`);
      if (i < 2) await sleep(1500 * (i + 1));
    }
  }
  if (majors.length) { result[u.nameS] = majors; ok++; }
  else if (result[u.nameS]?.length) { kept++; } // 保留舊數據，防限流誤清
  else empty++;
  process.stdout.write(`${ok + empty + kept}/${unis.length} ${u.nameS}: ${majors.length || result[u.nameS]?.length || 0} 專業\r`);
  await sleep(1200);
}
fs.mkdirSync('data/raw', { recursive: true });
fs.writeFileSync('data/raw/majors-2027.json', JSON.stringify(result, null, 1));
console.log(`\nOK: ${ok} 所新抓到專業，${kept} 所沿用舊數據，${empty} 所暫無 -> data/raw/majors-2027.json`);
