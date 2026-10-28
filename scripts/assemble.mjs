// 一次性重組 app.js（跑一次後刪除）
import fs from 'node:fs';

let head = fs.readFileSync('assets/app.js.head.tmp', 'utf-8');
const compare = fs.readFileSync('assets/app.js.compare.tmp', 'utf-8');
const tail = fs.readFileSync('assets/app.js.tail.tmp', 'utf-8');

// 1) head：移除將在新模組定義的重複宣告
head = head.replace(`const setCompareIds = (ids) => localStorage.setItem(COMPARE_KEY, JSON.stringify([...new Set(ids)].slice(0, COMPARE_MAX)));
const rankNum = (u) => {
  const rk = u.rank2026 || u.rank2025 || {};
  return rk.overall ?? rk.rank ?? 9999;
};
const byRank = (a, b) => rankNum(a) - rankNum(b);`, '');

// 2) tail 改造：
let t = tail;

// 2a) 彈窗：全部大學預留 2027 簡章按鈕（未公佈狀態）
t = t.replace(`  const links = [];
  if (u.brief2027) links.push`, `  const links = [];
  if (!u.brief2027) links.push(\`<span class="btn btn-outline btn-reserved" title="DSEDJ 尚未上載該校 2027 簡章；公佈後本站每日自動更新，屆時可直接預覽">📖 2027 招生簡章 <span class="reserved-tag">未公佈</span></span>\`);
  if (u.brief2027) links.push`);

// 2b) 關於頁加更新日誌入口（不放首頁/導航）
t = t.replace(`    <h2>數據現況</h2>`, `    <h2>更新日誌</h2>
    <p>每次自動更新的變化記錄見 <a href="#/updatelog">更新日誌頁</a>（#updatelog）。</p>
    <h2>數據現況</h2>`);

// 2c) 新頁面：保送專業 + 更新日誌（插在「頁面：路由」前）
const newPages = `
/* ---------- 頁面：保送專業 ---------- */
const majorsState = { q: "", region: "" };
function parseMajor(m) {
  const mm = m.match(/\\[([0-9]+)\\]\\s*$/);
  const years = mm ? mm[1] : null;
  return { text: m.replace(/\\s*\\[[0-9]+\\]\\s*$/, ""), years };
}
function pageMajors() {
  const withM = state.unis.filter(u => u.majors2027?.length).sort(byRank);
  const without = state.unis.filter(u => !u.majors2027?.length);
  $app.innerHTML = \`
  <h1 style="margin-top:6px">2027 保送專業 <small style="color:var(--muted);font-size:.85rem">\${withM.length} / \${state.unis.length} 所已公佈 · 每日自動更新</small></h1>
  <div class="notice">資料來自 DSEDJ「查詢內地高校招生專業」系統（首階段）。各大學陸續錄入中——下面「尚未公佈」的學校，公佈後會自動出現。括號內為專業組包含的方向，[數字] 為學制年數。</div>
  <div class="filter-bar">
    <input type="search" id="mj-q" placeholder="搜專業關鍵字（如：臨床、會計、電腦）或大學名…" value="\${esc(majorsState.q)}">
    <select id="mj-region"><option value="">全部地區</option>\${[...new Set(state.unis.map(u => u.region))].map(r => \`<option \${majorsState.region === r ? "selected" : ""}>\${esc(r)}</option>\`).join("")}</select>
    <div class="result-count" id="mj-count"></div>
  </div>
  <div id="mj-list"></div>\`;
  const render = () => {
    const q = majorsState.q.trim().toLowerCase();
    const list = withM.filter(u => {
      if (majorsState.region && u.region !== majorsState.region) return false;
      if (!q) return true;
      const hay = (u.name + u.nameS + u.majors2027.join(" ")).toLowerCase();
      return hay.includes(q);
    });
    document.getElementById("mj-count").textContent = \`符合 \${list.length} 所\`;
    document.getElementById("mj-list").innerHTML = list.map(u => {
      const hits = q ? u.majors2027.filter(m => (m + u.name).toLowerCase().includes(q)) : u.majors2027;
      return \`<div class="major-card">
        <div class="major-head" data-id="\${esc(u.id)}">
          <b>\${esc(u.name)}</b>
          <span style="color:var(--muted);font-size:.84rem">\${esc(u.region)} · \${u.rank2026 ? \`軟科 \${u.rank2026.rank}\` : "未設榜"} · 名額 \${u.quota2027 ?? "—"}</span>
          <span class="major-count">\${u.majors2027.length} 個專業</span>
        </div>
        <ul class="majors-list">\${hits.map(m => { const p = parseMajor(m); return \`<li>\${esc(p.text)}\${p.years ? \` <span class="major-years">\${p.years} 年制</span>\` : ""}</li>\`; }).join("")}</ul>
      </div>\`;
    }).join("") || \`<div class="empty-tip">找不到符合的專業／大學</div>\`;
    if (!q && !majorsState.region) {
      document.getElementById("mj-list").insertAdjacentHTML("beforeend", \`
        <h2 class="section-title">⏳ 尚未公佈專業的學校（\${without.length} 所）<small>公佈後自動加入</small></h2>
        <div class="tag-row">\${without.sort((a, b) => byRank(a, b)).map(u => \`<span class="cmp-chip" style="cursor:pointer" data-goto="\${esc(u.id)}">\${esc(u.name)}\${u.brief2027 ? " 📄" : ""}</span>\`).join("")}</div>\`);
      document.querySelectorAll("[data-goto]").forEach(el => el.onclick = () => { location.hash = "#/uni/" + el.dataset.goto; });
    }
    document.querySelectorAll(".major-head").forEach(h => h.onclick = () => { location.hash = "#/uni/" + h.dataset.id; });
  };
  document.getElementById("mj-q").addEventListener("input", e => { majorsState.q = e.target.value; render(); });
  document.getElementById("mj-region").addEventListener("change", e => { majorsState.region = e.target.value; render(); });
  render();
}

/* ---------- 頁面：更新日誌 ---------- */
async function pageUpdatelog() {
  $app.innerHTML = \`
  <h1 style="margin-top:6px">更新日誌 <small style="color:var(--muted);font-size:.85rem">每次自動資料更新的變化記錄</small></h1>
  <div class="notice">名單公佈期（至 2026 年 11 月初）每日更新，之後每月更新；只有資料有變化才會產生記錄。</div>
  <div id="ul-body"><div class="empty-tip">載入中…</div></div>\`;
  let log = [];
  try { log = await fetch("data/updatelog.json").then(r => r.json()); } catch {}
  document.getElementById("ul-body").innerHTML = log.length ? log.map(e => \`
    <div class="ul-entry">
      <div class="ul-date">🗓 \${esc(e.date)} <span style="color:var(--muted);font-size:.8rem">· \${e.counts ? \`\${e.counts.universities} 所高校 · \${e.counts.withBrief2027 ?? "—"} 所已有簡章 · \${e.counts.withMajors ?? "—"} 所已有專業\` : ""}</span></div>
      <ul class="majors-list">\${(e.changes || []).map(c => \`<li>\${esc(c)}</li>\`).join("")}</ul>
    </div>\`).join("") : \`<div class="empty-tip">暫無記錄</div>\`;
}

`;
t = t.replace("/* ---------- 路由 ---------- */", newPages + "/* ---------- 路由 ---------- */");

// 2d) 路由加入兩條
t = t.replace(`  if (hash.startsWith("#/rankings")) return pageRankings();`,
  `  if (hash.startsWith("#/majors")) return pageMajors();\n  if (hash.startsWith("#/updatelog")) return pageUpdatelog();\n  if (hash.startsWith("#/rankings")) return pageRankings();`);

// 2e) 主題切換：init 前掛載
t = t.replace(`(async function init() {
  await loadData();`, `/* ---------- 深色／淺色模式 ---------- */
const THEME_KEY = "macau-uni-theme";
function applyTheme() {
  const pref = localStorage.getItem(THEME_KEY);
  const dark = pref === "dark" || (!pref && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const btn = document.getElementById("theme-toggle");
  if (btn) { btn.textContent = dark ? "☀️" : "🌙"; btn.title = dark ? "切換到淺色模式" : "切換到深色模式"; }
}
function initTheme() {
  applyTheme();
  document.getElementById("theme-toggle").onclick = () => {
    localStorage.setItem(THEME_KEY, document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    applyTheme();
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
}

(async function init() {
  initTheme();
  await loadData();`);

fs.writeFileSync('assets/app.js', head + "\n" + compare + "\n" + t);
fs.unlinkSync('assets/app.js.head.tmp');
fs.unlinkSync('assets/app.js.tail.tmp');
fs.unlinkSync('assets/app.js.compare.tmp');
console.log('app.js 重組完成');
