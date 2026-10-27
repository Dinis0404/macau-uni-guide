// 合併 DSEDJ 名單 + 軟科排名 + 人工簡介 + 濠江保送數據 → data/universities.json 等
// 用法: node scripts/build.mjs
import fs from 'node:fs';
import OpenCC from 'opencc-js';

const read = (p, fallback = null) =>
  fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : fallback;
const cc = OpenCC.Converter({ from: 'cn', to: 't' });
const t = (s) => (s ? cc(s) : s);

const dsedj = read('data/raw/dsedj-2027.json');
if (!dsedj) { console.error('缺 data/raw/dsedj-2027.json，先跑 node scripts/fetch-dsedj.mjs'); process.exit(1); }
const intros = read('data/intros.json', {});
const aliases = read('data/aliases.json', {}); // DSEDJ名 -> 軟科名
const houkong = read('data/houkong-2025.json', {});

// ---- 載入軟科各榜 ----
const YEARS = [2025, 2026];
const BOARD_CN = {
  main: '主榜', sinoforeign: '合作辦學榜', medical: '醫藥類', finance: '財經類',
  language: '語言類', ethnic: '民族類', political: '政法類', sports: '體育類', tcm: '中醫藥類',
};
const boards = {}; // boards[year][board] = [{...}]
for (const y of YEARS) {
  boards[y] = {};
  for (const b of Object.keys(BOARD_CN)) {
    const f = read(`data/raw/ruanke-${y}-${b}.json`);
    if (f) boards[y][b] = f;
  }
}
// 每年：名 -> 榜單項（主榜優先；名帶別名索引）
const nameIndex = {}; // nameS -> {year -> {board, rank, rankOverall, entry}}
for (const y of YEARS) {
  nameIndex[y] = {};
  const order = ['main', 'sinoforeign', 'medical', 'finance', 'language', 'political', 'sports', 'tcm', 'ethnic'];
  for (const b of order) {
    for (const e of boards[y][b] || []) {
      if (!nameIndex[y][e.name]) nameIndex[y][e.name] = { board: BOARD_CN[b], rank: e.rank, overall: e.rankOverall, slug: e.slug, nameEn: e.nameEn };
    }
  }
}

// ---- 合併每所大學 ----
const missing = [];
const unis = dsedj.map(u => {
  const meta = intros[u.nameS] || null;
  if (!meta) missing.push(u.nameS);
  const rk = {};
  for (const y of YEARS) {
    const hit = nameIndex[y][aliases[u.nameS] || u.nameS] || null;
    rk[y] = hit ? { board: hit.board, rank: hit.rank, overall: hit.overall } : null;
  }
  const hk = (houkong.perUniversity || {})[u.nameS] ?? (houkong.perUniversity || {})[t(u.nameS)] ?? null;
  const nameT = t(u.nameS);
  const searchParts = [nameT, u.nameS, t(u.region), u.region, (meta?.tags || []).join(' '), meta?.intro || '', t(meta?.intro || '')];
  for (const y of YEARS) if (rk[y]) searchParts.push(rk[y].nameEn || '');
  return {
    id: u.brief2026?.u_id || u.brief2027?.u_id || String(u.seq),
    name: nameT,
    nameS: u.nameS,
    region: t(u.region),
    quota2027: u.quota,
    exam: u.exam ? t(u.exam) : null,
    extra: u.extra ? t(u.extra) : null,
    tags: meta?.tags || [],
    rank2025: rk[2025],
    rank2026: rk[2026],
    houkong2025: hk,
    intro: meta?.intro || null,
    website: meta?.website || null,
    brief2026: u.brief2026?.url || null,
    brief2027: u.brief2027?.url || null,
    search: [...new Set(searchParts.filter(Boolean))].join(' '),
  };
});

// ---- 排名頁完整榜單（只保留 2026 + 2025 主榜與主要分榜，精簡欄位）----
const slim = (arr) => (arr || []).map(e => ({ r: e.rankDisplay, n: e.name, p: e.province, c: e.category, s: e.score, t: (e.tags || []).map(x => x === "双一流" ? "雙一流" : x) }));
const rankings = {
  note: '來源：軟科中國大學排名（shanghairanking.cn）。rankDisplay 為官方顯示名次（含並列、500+）。',
  years: {},
};
for (const y of YEARS) {
  if (!boards[y].main) continue;
  rankings.years[y] = {};
  for (const b of Object.keys(BOARD_CN)) if (boards[y][b]) rankings.years[y][b] = slim(boards[y][b]);
}

const meta = {
  generatedAt: new Date().toISOString(),
  cycle: '2027',
  counts: {
    universities: unis.length,
    quotaTotal: unis.reduce((a, u) => a + (u.quota2027 || 0), 0),
    withIntro: unis.filter(u => u.intro).length,
    withRank2026: unis.filter(u => u.rank2026).length,
    withHoukong: unis.filter(u => u.houkong2025 != null).length,
  },
  sources: {
    dsedj: 'https://appl2.dsedj.gov.mo/ChinaUEnrollment/index.jsp',
    ruanke: 'https://www.shanghairanking.cn/rankings/bcur',
  },
};

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/universities.json', JSON.stringify(unis, null, 1));
fs.writeFileSync('data/rankings.json', JSON.stringify(rankings));
fs.writeFileSync('data/meta.json', JSON.stringify(meta, null, 2));

console.log('universities:', unis.length);
console.log('meta:', JSON.stringify(meta.counts));
console.log('缺簡介:', missing.join(', ') || '無');
const noRank = unis.filter(u => !u.rank2026).map(u => u.nameS);
console.log('2026 無軟科排名:', noRank.join(', ') || '無');
