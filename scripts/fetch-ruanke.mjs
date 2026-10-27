// 從軟科官方 API 抓取中國大學排名（主榜 + 各類別榜）
// 用法: node scripts/fetch-ruanke.mjs [2025,2026]
import fs from 'node:fs';
import path from 'node:path';

const YEARS = (process.argv[2] || '2025,2026').split(',').map(Number);
const BOARDS = {
  11: 'main',      // 主榜
  14: 'sinoforeign', // 中外合作辦學榜
  21: 'medical',   // 醫藥類
  22: 'finance',   // 財經類
  23: 'language',  // 語言類
  24: 'ethnic',    // 民族類
  25: 'political', // 政法類
  26: 'sports',    // 體育類
  745: 'tcm',      // 中醫藥類
};
const BOARD_CN = {
  main: '主榜', sinoforeign: '合作辦學榜', medical: '醫藥類', finance: '財經類',
  language: '語言類', ethnic: '民族類', political: '政法類', sports: '體育類', tcm: '中醫藥類',
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchBoard(type, year, tries = 3) {
  const url = `https://www.shanghairanking.cn/api/pub/v1/bcur?bcur_type=${type}&year=${year}`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await res.json();
      if (j.code !== 200 || !j.data?.rankings) throw new Error('code=' + j.code);
      return j.data.rankings;
    } catch (e) {
      console.warn(`  retry ${i + 1} for type=${type} year=${year}: ${e.message}`);
      await sleep(3000 * (i + 1));
    }
  }
  throw new Error(`failed: bcur_type=${type} year=${year}`);
}

const clean = (list) => list.map(r => ({
  rank: /^\d+$/.test(r.ranking || '') ? Number(r.ranking) : null,
  rankDisplay: r.ranking || '',
  rankOverall: /^\d+$/.test(r.rankOverall || '') ? Number(r.rankOverall) : null,
  name: r.univNameCn,
  nameEn: r.univNameEn || '',
  province: r.province || '',
  category: r.univCategory || '',
  tags: Array.isArray(r.univTags) ? r.univTags : [],
  score: typeof r.score === 'number' ? r.score : null,
  slug: r.univUp || '',
}));

fs.mkdirSync('data/raw', { recursive: true });
for (const year of YEARS) {
  for (const [type, board] of Object.entries(BOARDS)) {
    const list = await fetchBoard(type, year);
    const out = path.join('data/raw', `ruanke-${year}-${board}.json`);
    fs.writeFileSync(out, JSON.stringify(clean(list), null, 1));
    console.log(`${year} ${BOARD_CN[board]}(type=${type}): ${list.length} 所 -> ${out}`);
    await sleep(1200);
  }
}
console.log('done.');
