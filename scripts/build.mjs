// 合併 DSEDJ 名單 + 軟科排名 + 人工簡介 + 濠江保送數據 → data/universities.json 等
// 用法: node scripts/build.mjs
import fs from 'node:fs';
import OpenCC from 'opencc-js';

const read = (p, fallback = null) =>
  fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : fallback;
const cc = OpenCC.Converter({ from: 'cn', to: 't' });
const t = (s) => (s ? cc(s).replace(/覈/g, '核').replace(/羣/g, '群') : s);

const dsedj = read('data/raw/dsedj-2027.json');
if (!dsedj) { console.error('缺 data/raw/dsedj-2027.json，先跑 node scripts/fetch-dsedj.mjs'); process.exit(1); }
const intros = read('data/intros.json', {});
const aliases = read('data/aliases.json', {}); // DSEDJ名 -> 軟科名
const houkong = read('data/houkong-2025.json', {});
const majors = read('data/raw/majors-2027.json', {});

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
  const hkAll = { ...houkong.perUniversity, ...houkong.perUniversityTwo, ...houkong.perUniversityLocal };
  const hk = hkAll[u.nameS] ?? hkAll[t(u.nameS)] ?? null;
  const nameT = t(u.nameS);
  const searchParts = [nameT, u.nameS, t(u.region), u.region, (meta?.tags || []).join(' '), meta?.intro || '', t(meta?.intro || '')];
  for (const y of YEARS) if (rk[y]) searchParts.push(rk[y].nameEn || '');
  return {
    id: u.brief2026?.u_id || u.brief2027?.u_id || String(u.seq),
    name: nameT,
    nameS: u.nameS,
    region: t(u.region),
    scheme: '保送',
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
    majors2027: (majors[u.nameS] || []).map(t),
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

// ---- 額外大學（兩校聯招等，非 DSEDJ 保送名單）----
const extras = (read('data/extra-unis.json', { unis: [] }).unis || []).map(x => {
  const nameT = t(x.nameS);
  const rk = {};
  for (const y of YEARS) {
    const hit = nameIndex[y][x.nameS] || null;
    rk[y] = hit ? { board: hit.board, rank: hit.rank, overall: hit.overall } : null;
  }
  const searchParts = [nameT, x.nameS, t(x.region), x.region, (x.tags || []).join(' '), x.intro || '', t(x.intro || ''), '兩校聯招'];
  for (const y of YEARS) if (rk[y]) searchParts.push(rk[y].nameEn || '');
  return {
    id: x.id, name: nameT, nameS: x.nameS, region: t(x.region),
    scheme: x.scheme || '兩校聯招',
    quota2027: null, exam: t(x.exam) || null, extra: t(x.extra) || null,
    tags: x.tags || [], rank2025: rk[2025], rank2026: rk[2026], rankWorld2025: x.rankWorld2025 || null,
    houkong2025: null, intro: x.intro || null, website: x.website || null,
    brief2026: null, brief2027: null, majors2027: [],
    admissionsUrl: x.admissionsUrl || null, admissionsLabel: x.admissionsLabel || null,
    search: [...new Set(searchParts.filter(Boolean))].join(' '),
  };
});
const hkAll = { ...houkong.perUniversity, ...houkong.perUniversityTwo, ...houkong.perUniversityLocal };
for (const e of extras) e.houkong2025 = hkAll[e.nameS] ?? hkAll[e.name] ?? null;
unis.push(...extras);

const meta = {
  generatedAt: new Date().toISOString(),
  cycle: '2027',
  counts: {
    universities: unis.length,
    universitiesBS: dsedj.length,
    quotaTotal: unis.reduce((a, u) => a + (u.quota2027 || 0), 0),
    withIntro: unis.filter(u => u.intro).length,
    withRank2026: unis.filter(u => u.rank2026).length,
    withHoukong: unis.filter(u => u.houkong2025 != null).length,
    withBrief2027: unis.filter(u => u.brief2027).length,
    withMajors: unis.filter(u => u.majors2027?.length).length,
  },
  sources: {
    dsedj: 'https://appl2.dsedj.gov.mo/ChinaUEnrollment/index.jsp',
    ruanke: 'https://www.shanghairanking.cn/rankings/bcur',
  },
};

fs.mkdirSync('data', { recursive: true });
// ---- 更新日誌：與上一次的 universities.json 比對，記錄變化 ----
const changes = [];
const old = read('data/universities.json', []);
const oldByS = new Map(old.map(u => [u.nameS, u]));
for (const u of unis) {
  const o = oldByS.get(u.nameS);
  const name = t(u.nameS);
  if (!o) { changes.push(`🆕 新增收錄：${name}`); continue; }
  if (!o.brief2027 && u.brief2027) changes.push(`📄 ${name}：公佈 2027 招生簡章`);
  const om = (o.majors2027 || []).length, nm = (u.majors2027 || []).length;
  if (!om && nm) changes.push(`📋 ${name}：公佈 2027 保送專業（${nm} 個）`);
  else if (om && nm > om) changes.push(`📋 ${name}：保送專業 ${om} → ${nm} 個`);
  if (o.quota2027 !== u.quota2027) changes.push(`🔢 ${name}：保送名額 ${o.quota2027 ?? '—'} → ${u.quota2027 ?? '—'}`);
  if ((o.exam || null) !== (u.exam ? u.exam : null) && t(u.exam || '') !== (o.exam || '')) changes.push(`📝 ${name}：考核方式變更（${o.exam || '未標示'} → ${t(u.exam) || '未標示'}）`);
  if ((o.houkong2025 ?? null) !== (u.houkong2025 ?? null)) changes.push(`🎓 ${name}：濠江 2025 保送人數更新為 ${u.houkong2025} 人`);
  if ((o.rank2026?.rank ?? null) !== (u.rank2026?.rank ?? null) && u.rank2026) changes.push(`📊 ${name}：軟科 2026 排名 ${o.rank2026?.rank ?? '—'} → ${u.rank2026.rank}`);
}
const today = new Date().toISOString().slice(0, 10);
const log = read('data/updatelog.json', []);
const last = log[0];
if (changes.length && (!last || last.date !== today || last.changes.join('|') !== changes.join('|'))) {
  log.unshift({ date: today, at: new Date().toISOString(), counts: meta.counts, changes });
  fs.writeFileSync('data/updatelog.json', JSON.stringify(log.slice(0, 120), null, 1));
  console.log(`updatelog: 新增 ${changes.length} 條變化記錄`);
} else if (!log.length) {
  const seeded = [
    `📄 ${unis.filter(u => u.brief2027).length} 所已公佈 2027 招生簡章`,
    `📋 ${unis.filter(u => (u.majors2027 || []).length).length} 所已公佈 2027 保送專業`,
    `🎓 濠江中學 2025 聯校保送數據載入（210 人 / 70 校）`,
    `📊 軟科 2025 + 2026 排名載入（主榜及 7 個分榜）`,
  ];
  log.unshift({ date: today, at: new Date().toISOString(), counts: meta.counts, changes: seeded });
  fs.writeFileSync('data/updatelog.json', JSON.stringify(log.slice(0, 120), null, 1));
  console.log('updatelog: 建立初始記錄');
} else {
  console.log('updatelog: 無變化');
}
fs.writeFileSync('data/universities.json', JSON.stringify(unis, null, 1));
fs.writeFileSync('data/rankings.json', JSON.stringify(rankings));
fs.writeFileSync('data/meta.json', JSON.stringify(meta, null, 2));

console.log('universities:', unis.length);
console.log('meta:', JSON.stringify(meta.counts));
console.log('缺簡介:', missing.join(', ') || '無');
const noRank = unis.filter(u => !u.rank2026).map(u => u.nameS);
console.log('2026 無軟科排名:', noRank.join(', ') || '無');
