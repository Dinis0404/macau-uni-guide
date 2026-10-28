/* 澳門保送大學指南 — 純前端單頁應用（無框架、無構建） */
"use strict";

const $app = document.getElementById("app");
const $modalRoot = document.getElementById("modal-root");
const BOARD_CN = {
  main: "主榜", sinoforeign: "合作辦學榜", medical: "醫藥類", finance: "財經類",
  language: "語言類", ethnic: "民族類", political: "政法類", sports: "體育類", tcm: "中醫藥類",
};

const state = { unis: [], rankings: null, meta: null };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rankText = (rk, year = 2026) => {
  if (!rk) return null;
  const base = rk.board === "主榜" ? `主榜第 ${rk.rank} 名` : `${rk.board}第 ${rk.rank} 名`;
  return `軟科 ${year} ${base}`;
};

async function loadData() {
  const [unis, rankings, meta] = await Promise.all([
    fetch("data/universities.json").then(r => r.json()),
    fetch("data/rankings.json").then(r => r.json()).catch(() => null),
    fetch("data/meta.json").then(r => r.json()).catch(() => null),
  ]);
  state.unis = unis; state.rankings = rankings; state.meta = meta;
  const m = document.getElementById("footer-meta");
  if (m && meta) m.textContent = `資料版本 ${meta.generatedAt.slice(0, 10)} · ${meta.counts.universities} 所高校`;
}

/* ---------- 共用元件 ---------- */
function tagHTML(tags) {
  return (tags || []).map(t => `<span class="tag tag-${esc(t)}">${esc(t)}</span>`).join("");
}
function rankBadgeHTML(u) {
  const rk = u.rank2026 || u.rank2025;
  if (!rk) return `<span class="rank-badge na" title="軟科中國大學排名未涵蓋該校（如藝術類、部分校區）">軟科未設榜</span>`;
  const y = u.rank2026 ? 2026 : 2025;
  const suffix = rk.board !== "主榜" && rk.overall ? `（主榜線 ${rk.overall}）` : "";
  return `<span class="rank-badge" title="${esc(rankText(rk, y))}${suffix}">${esc(rankText(rk, y))}${suffix}</span>`;
}
function uniCardHTML(u) {
  const hk = u.houkong2025;
  return `
  <article class="uni-card" data-id="${esc(u.id)}">
    <div class="uni-card-top">
      <h3 class="uni-name">${esc(u.name)}</h3>
      <span class="uni-region">${esc(u.region)}</span>
    </div>
    <div class="tag-row">${tagHTML(u.tags)}${u.exam ? `<span class="exam-chip">📋 ${esc(u.exam)}</span>` : `<span class="exam-chip">📋 免筆試面試（以簡章為準）</span>`}</div>
    ${rankBadgeHTML(u)}
    <div class="uni-nums">
      <div class="uni-num"><small>2027 保送名額</small><b>${u.quota2027 ?? "—"}</b></div>
      <div class="uni-num"><small>2025 濠江保送</small><b class="${hk >= 5 ? "hk-hot" : ""}">${hk != null ? hk + " 人" : "暫無資料"}</b></div>
    </div>
  </article>`;
}

function showModal(u) {
  const hk = u.houkong2025;
  const links = [];
  if (u.brief2027) links.push(`<a class="btn btn-primary" href="${esc(u.brief2027)}" target="_blank" rel="noopener">📄 2027 招生簡章（PDF）</a>`);
  if (u.brief2026) links.push(`<a class="btn btn-outline" href="${esc(u.brief2026)}" target="_blank" rel="noopener">📄 2026 簡章（參考）</a>`);
  if (u.website) links.push(`<a class="btn btn-outline" href="${esc(u.website)}" target="_blank" rel="noopener">🔗 大學官網</a>`);
  links.push(`<a class="btn btn-outline" id="add-compare" href="javascript:void(0)">⚖️ ${compareIds().includes(u.id) ? "已在對比 · 前往對比 →" : "加入對比"}</a>`);
  links.push(`<a class="btn btn-outline" href="https://www.shanghairanking.cn/rankings/bcur" target="_blank" rel="noopener">📊 軟科官網</a>`);

  const rkFmt = (rk) => !rk ? "未設榜" : rk.board === "主榜" ? `主榜第 ${rk.rank} 名`
    : `${rk.board}第 ${rk.rank} 名${rk.overall ? ` · 主榜線 ${rk.overall}` : ""}`;
  const rk26 = u.rank2026, rk25 = u.rank2025;
  $modalRoot.innerHTML = `
  <div class="modal-backdrop" id="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal-close" id="modal-close" aria-label="關閉">✕</button>
      <h2>${esc(u.name)}</h2>
      <div class="sub">${esc(u.region)} · <span class="tag-row" style="display:inline-flex">${tagHTML(u.tags)}</span></div>
      ${u.intro ? `<div class="intro-box">${esc(u.intro)}<div style="font-size:.75rem;color:var(--muted);margin-top:6px">簡介由本項目撰寫，僅供參考，以官方為準。</div></div>` : ""}
      <div class="fact-grid">
        <div class="fact"><small>2027 保送名額</small><b>${u.quota2027 ?? "—"} 人</b></div>
        <div class="fact"><small>考核方式</small><b>${u.exam ? esc(u.exam) : "見招生簡章"}</b></div>
        <div class="fact"><small>軟科 2026</small><b>${esc(rkFmt(rk26))}</b></div>
        <div class="fact"><small>軟科 2025</small><b>${esc(rkFmt(rk25))}</b></div>
        <div class="fact"><small>2025 濠江中學保送</small><b>${hk != null ? hk + " 人" : "暫無資料"}</b></div>
      </div>
      ${u.extra ? `<div class="extra-box"><b>另定要求：</b>${esc(u.extra)}</div>` : ""}
      <div class="link-row">${links.join("")}</div>
      <p class="disclaim">名額與考核要求摘自 DSEDJ「2027 年保送高校名單」，可能隨官方更新而變動，報名前務必細閱招生簡章原文。</p>
    </div>
  </div>`;
  const close = () => { $modalRoot.innerHTML = ""; if (location.hash.startsWith("#/uni/")) location.hash = state.lastListRoute || "#/list"; };
  document.getElementById("modal-close").onclick = close;
  document.getElementById("modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") close(); };
  const cmpBtn = document.getElementById("add-compare");
  cmpBtn.onclick = () => {
    const ids = compareIds();
    if (ids.includes(u.id)) { location.hash = "#/compare"; return; }
    if (ids.length >= COMPARE_MAX) { cmpBtn.textContent = "⚠️ 對比最多 4 所，請先移除"; return; }
    setCompareIds([...ids, u.id]);
    cmpBtn.textContent = "✓ 已加入 · 前往對比 →";
  };
  const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
}

/* ---------- 頁面：首頁 ---------- */
function pageHome() {
  const c = state.meta?.counts || {};
  const top = [...state.unis].filter(u => u.houkong2025 != null).sort((a, b) => b.houkong2025 - a.houkong2025).slice(0, 10);
  $app.innerHTML = `
  <section class="hero">
    <h1>一站式看清內地高校澳門保送</h1>
    <p>整合 DSEDJ 官方保送名單、各校招生簡章、軟科大學排名與學長姐保送去向，幫你快速比較 128 所內地高校，選出最適合你的志願。</p>
    <div class="cta">
      <a class="btn btn-primary" href="#/list">開始比較高校 →</a>
      <a class="btn btn-ghost" href="#/faq">了解保送流程</a>
    </div>
  </section>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-num">${c.universities ?? "—"}</div><div class="stat-label">2027 參與保送高校</div></div>
    <div class="stat-card"><div class="stat-num">${c.quotaTotal ?? "—"}</div><div class="stat-label">保送名額總數</div></div>
    <div class="stat-card"><div class="stat-num">210</div><div class="stat-label">濠江中學 2025 聯校保送人數</div></div>
    <div class="stat-card"><div class="stat-num">${c.withHoukong ?? "—"}</div><div class="stat-label">有保送去向數據的高校</div></div>
  </div>
  <h2 class="section-title">🔥 2025 濠江中學保送去向 Top 10 <small>（聯校保送，來源：濠江中學官網）</small></h2>
  <div class="table-wrap"><table class="data">
    <thead><tr><th>#</th><th>大學</th><th>地區</th><th>2025 濠江保送</th><th>2027 名額</th><th>軟科 2026</th></tr></thead>
    <tbody>${top.map((u, i) => `<tr data-id="${esc(u.id)}" style="cursor:pointer">
      <td>${i + 1}</td><td><b>${esc(u.name)}</b></td><td>${esc(u.region)}</td>
      <td><b>${u.houkong2025} 人</b></td><td>${u.quota2027 ?? "—"}</td>
      <td>${u.rank2026 ? esc(u.rank2026.board === "主榜" ? `第 ${u.rank2026.rank} 名` : `${u.rank2026.board}第 ${u.rank2026.rank} 名`) : "未設榜"}</td>
    </tr>`).join("")}</tbody>
  </table></div>
  <h2 class="section-title">📅 2027 屆關鍵日期 <small>（來源：DSEDJ）</small></h2>
  <div class="timeline">
    <div class="tl-item"><h3>網上報名／學校推薦</h3><div class="when">2026-11-13 09:00 至 11-24 16:00</div><p>經一戶通登入報名，可於 11-25 至 11-27 更改志願。</p></div>
    <div class="tl-item"><h3>保送考試</h3><div class="when">2027-01-16 09:00–18:00</div><p>部分高校另設面試或筆試，見各校「考核方式」。</p></div>
    <div class="tl-item"><h3>首輪錄取公佈 · 徵集志願</h3><div class="when">2027-01-17</div><p>08:00 公佈首輪名單；09:00–15:00 徵集志願報名，當晚完成徵集考試。</p></div>
    <div class="tl-item"><h3>錄取總名單公佈</h3><div class="when">2027-01-19 18:00</div><p>塵埃落定，準備九月入學！</p></div>
  </div>
  <p style="color:var(--muted);font-size:.85rem">完整時間表見 <a href="#/faq">保送流程頁</a>。</p>`;
  bindCards();
}

/* ---------- 頁面：高校列表 ---------- */
const listState = { q: "", region: "", tag: "", sort: "rank" };
function pageList() {
  const regions = [...new Set(state.unis.map(u => u.region))];
  $app.innerHTML = `
  <h1 style="margin-top:6px">高校列表 <small style="color:var(--muted);font-size:.85rem">2027 年保送 · DSEDJ 名單</small></h1>
  <div class="filter-bar">
    <input type="search" id="f-q" placeholder="搜尋大學（繁簡均可）…" value="${esc(listState.q)}">
    <select id="f-region"><option value="">全部地區</option>${regions.map(r => `<option ${listState.region === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
    <select id="f-tag">
      <option value="">全部標籤</option>
      <option value="985" ${listState.tag === "985" ? "selected" : ""}>985</option>
      <option value="211" ${listState.tag === "211" ? "selected" : ""}>211</option>
      <option value="雙一流" ${listState.tag === "雙一流" ? "selected" : ""}>雙一流</option>
      <option value="none" ${listState.tag === "none" ? "selected" : ""}>非 985/211</option>
    </select>
    <select id="f-sort">
      <option value="rank" ${listState.sort === "rank" ? "selected" : ""}>按軟科排名</option>
      <option value="quota" ${listState.sort === "quota" ? "selected" : ""}>按 2027 名額</option>
      <option value="hk" ${listState.sort === "hk" ? "selected" : ""}>按濠江保送人數</option>
      <option value="name" ${listState.sort === "name" ? "selected" : ""}>按筆劃／名稱</option>
    </select>
    <div class="result-count" id="f-count"></div>
  </div>
  <div class="uni-grid" id="uni-grid"></div>`;
  const rerender = () => renderList();
  ["f-q", "f-region", "f-tag", "f-sort"].forEach(id => {
    document.getElementById(id).addEventListener("input", (e) => {
      listState[{ "f-q": "q", "f-region": "region", "f-tag": "tag", "f-sort": "sort" }[id]] = e.target.value;
      rerender();
    });
  });
  renderList();
}
function renderList() {
  const q = listState.q.trim().toLowerCase();
  let list = state.unis.filter(u => {
    if (q && !u.search.toLowerCase().includes(q)) return false;
    if (listState.region && u.region !== listState.region) return false;
    if (listState.tag === "none" && u.tags.some(t => t === "985" || t === "211")) return false;
    else if (listState.tag && listState.tag !== "none" && !u.tags.includes(listState.tag)) return false;
    return true;
  });
  const rk = u => (u.rank2026 || u.rank2025 || {}).rank ?? 9999;
  if (listState.sort === "rank") list.sort((a, b) => rk(a) - rk(b) || (b.quota2027 || 0) - (a.quota2027 || 0));
  if (listState.sort === "quota") list.sort((a, b) => (b.quota2027 || 0) - (a.quota2027 || 0) || rk(a) - rk(b));
  if (listState.sort === "hk") list.sort((a, b) => (b.houkong2025 ?? -1) - (a.houkong2025 ?? -1) || rk(a) - rk(b));
  if (listState.sort === "name") list.sort((a, b) => a.nameS.localeCompare(b.nameS, "zh-Hans"));
  document.getElementById("f-count").textContent = `共 ${list.length} 所`;
  document.getElementById("uni-grid").innerHTML = list.length
    ? list.map(uniCardHTML).join("")
    : `<div class="empty-tip" style="grid-column:1/-1">找不到符合條件的大學，試試其他關鍵字？</div>`;
  bindCards();
}
function bindCards() {
  document.querySelectorAll("[data-id]").forEach(el => {
    el.addEventListener("click", () => {
      const u = state.unis.find(x => x.id === el.dataset.id);
      if (u) { history.replaceState(null, "", "#/uni/" + u.id); showModal(u); }
    });
  });
}

/* ---------- 頁面：軟科排名 ---------- */
const rkState = { year: 2026, board: "main" };
function pageRankings() {
  const years = state.rankings ? Object.keys(state.rankings.years).sort().reverse().map(Number) : [];
  if (!years.length) { $app.innerHTML = "<p>排名資料載入失敗。</p>"; return; }
  if (!years.includes(rkState.year)) rkState.year = years[0];
  const boards = Object.keys(state.rankings.years[rkState.year] || {}).filter(b => state.rankings.years[rkState.year][b].length);
  if (!boards.includes(rkState.board)) rkState.board = boards[0];
  const inList = new Set(state.unis.map(u => u.nameS));

  $app.innerHTML = `
  <h1 style="margin-top:6px">軟科中國大學排名</h1>
  <p style="color:var(--muted);font-size:.9rem">來源：<a href="https://www.shanghairanking.cn/rankings/bcur" target="_blank" rel="noopener">上海軟科教育信息咨詢有限公司</a>。左側綠色標記 = 有參加澳門保送的大學。「主榜」不含醫藥、財經、語言、政法、體育、民族等單科類高校，請用分榜查看。</p>
  <div class="board-tabs" id="board-tabs">
    ${boards.map(b => `<button data-b="${b}" class="${b === rkState.board ? "active" : ""}">${BOARD_CN[b] || b}</button>`).join("")}
    <div class="year-toggle">${years.map(y => `<button data-y="${y}" class="${y === rkState.year ? "active" : ""}">${y}</button>`).join("")}</div>
  </div>
  <div class="table-wrap" style="max-height:72vh;overflow:auto"><table class="data">
    <thead><tr><th style="width:70px">名次</th><th>高校</th><th>省市</th><th>類別</th><th style="width:90px">綜合得分</th><th>標籤</th></tr></thead>
    <tbody id="rk-body"></tbody>
  </table></div>`;
  const render = () => {
    const rows = state.rankings.years[rkState.year][rkState.board] || [];
    document.getElementById("rk-body").innerHTML = rows.map(e => {
      const hit = inList.has(e.n);
      const u = hit ? state.unis.find(x => x.nameS === e.n) : null;
      const hk = u && u.houkong2025 != null ? ` <span style="color:var(--primary);font-size:.78rem">濠江 ${u.houkong2025}人</span>` : "";
      return `<tr class="${hit ? "in-list" : ""}">
        <td><b>${esc(e.r)}</b></td>
        <td>${esc(e.n)}${hit ? ' <span class="tag" style="background:var(--primary-light);color:var(--primary-dark)">保送</span>' : ""}${hk}</td>
        <td>${esc(e.p)}</td><td>${esc(e.c || "")}</td><td>${e.s ?? "—"}</td>
        <td>${(e.t || []).join("、")}</td></tr>`;
    }).join("");
  };
  document.querySelectorAll("#board-tabs [data-b]").forEach(btn => btn.onclick = () => {
    rkState.board = btn.dataset.b;
    document.querySelectorAll("#board-tabs [data-b]").forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
  document.querySelectorAll("#board-tabs [data-y]").forEach(btn => btn.onclick = () => {
    rkState.year = Number(btn.dataset.y);
    document.querySelectorAll("#board-tabs [data-y]").forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
  render();
}

/* ---------- 對比：localStorage 選擇 ---------- */
const COMPARE_KEY = "macau-uni-compare";
const COMPARE_MAX = 4;
const compareIds = () => {
  try {
    const ids = JSON.parse(localStorage.getItem(COMPARE_KEY) || "[]");
    return [...new Set(ids)].filter(id => state.unis.some(u => u.id === id)).slice(0, COMPARE_MAX);
  } catch { return []; }
};
const setCompareIds = (ids) => localStorage.setItem(COMPARE_KEY, JSON.stringify([...new Set(ids)].slice(0, COMPARE_MAX)));
const rankNum = (u) => {
  const rk = u.rank2026 || u.rank2025 || {};
  return rk.overall ?? rk.rank ?? 9999;
};
const byRank = (a, b) => rankNum(a) - rankNum(b);

/* ---------- 頁面：總表 ---------- */
const tableState = { q: "", sort: "rank", dir: 1 };
function pageTable() {
  $app.innerHTML = `
  <h1 style="margin-top:6px">總表 <small style="color:var(--muted);font-size:.85rem">128 所高校全欄位一覽 · 點欄位標題排序</small></h1>
  <div class="filter-bar">
    <input type="search" id="t-q" placeholder="搜尋大學（繁簡均可）…" value="${esc(tableState.q)}">
    <div class="result-count" id="t-count"></div>
  </div>
  <div class="table-wrap" style="max-height:74vh;overflow:auto"><table class="data big-table" id="big-table">
    <thead><tr>
      <th data-k="rank">軟科 2026</th><th data-k="name">大學</th><th data-k="region">地區</th>
      <th>標籤</th><th data-k="quota">2027 名額</th><th data-k="exam">考核方式</th>
      <th data-k="hk">濠江 2025</th><th>簡章</th>
    </tr></thead>
    <tbody id="t-body"></tbody>
  </table></div>
  <p style="color:var(--muted);font-size:.82rem">考核方式「見招生簡章」＝官方名單未標示統一考核，以簡章為準；「濠江 2025」為 2025 屆濠江中學內地聯校保送人數。點任何一行看完整詳情。</p>`;
  const rerender = () => renderTable();
  document.getElementById("t-q").addEventListener("input", e => { tableState.q = e.target.value; rerender(); });
  document.querySelectorAll("#big-table th[data-k]").forEach(th =>
    th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (tableState.sort === k) tableState.dir *= -1;
      else { tableState.sort = k; tableState.dir = k === "rank" ? 1 : -1; }
      rerender();
    }));
  renderTable();
}
function renderTable() {
  const q = tableState.q.trim().toLowerCase();
  const cmp = {
    rank: (a, b) => rankNum(a) - rankNum(b),
    name: (a, b) => a.nameS.localeCompare(b.nameS, "zh-Hans"),
    region: (a, b) => a.region.localeCompare(b.region, "zh-Hans") || rankNum(a) - rankNum(b),
    quota: (a, b) => (a.quota2027 || 0) - (b.quota2027 || 0),
    exam: (a, b) => (a.exam || "").localeCompare(b.exam || "", "zh-Hant") || rankNum(a) - rankNum(b),
    hk: (a, b) => (a.houkong2025 ?? -1) - (b.houkong2025 ?? -1),
  }[tableState.sort];
  let list = state.unis.filter(u => !q || u.search.toLowerCase().includes(q)).sort(cmp);
  if (tableState.dir === -1) list = list.slice().reverse();
  document.getElementById("t-count").textContent = `共 ${list.length} 所`;
  const sortMark = (k) => tableState.sort === k ? (tableState.dir === 1 ? " ▲" : " ▼") : "";
  document.querySelectorAll("#big-table th[data-k]").forEach(th => {
    const base = th.dataset.base || (th.dataset.base = th.textContent);
    th.innerHTML = base + sortMark(th.dataset.k);
  });
  const rkTxt = (u) => {
    const rk = u.rank2026 || u.rank2025;
    if (!rk) return `<span style="color:var(--muted)">未設榜</span>`;
    return rk.board === "主榜" ? `<b>${rk.rank}</b>` : `${rk.overall ?? "—"}<span style="color:var(--muted);font-size:.78rem">（${esc(rk.board)}${rk.rank}）</span>`;
  };
  document.getElementById("t-body").innerHTML = list.map(u => `
    <tr data-id="${esc(u.id)}" style="cursor:pointer">
      <td>${rkTxt(u)}</td>
      <td><b>${esc(u.name)}</b></td>
      <td>${esc(u.region)}</td>
      <td>${tagHTML(u.tags) || "—"}</td>
      <td><b>${u.quota2027 ?? "—"}</b></td>
      <td style="font-size:.85rem">${u.exam ? esc(u.exam) : "見招生簡章"}</td>
      <td>${u.houkong2025 != null ? `<b style="color:var(--primary)">${u.houkong2025}</b> 人` : `<span style="color:var(--muted)">暫無資料</span>`}</td>
      <td style="white-space:nowrap">${u.brief2027 ? `<a href="${esc(u.brief2027)}" target="_blank" rel="noopener" class="mini-link" onclick="event.stopPropagation()">2027</a>` : ""} ${u.brief2026 ? `<a href="${esc(u.brief2026)}" target="_blank" rel="noopener" class="mini-link" onclick="event.stopPropagation()">2026</a>` : ""}${!u.brief2027 && !u.brief2026 ? "—" : ""}</td>
    </tr>`).join("") || `<tr><td colspan="8" class="empty-tip">找不到符合的大學</td></tr>`;
  bindCards();
}

/* ---------- 頁面：大學對比 ---------- */
const COLORS = ["#0e7a5f", "#d35400", "#7d3c98", "#2e86c1"];
const EXAM_FRIEND = { "面試": 70, "材料審核+面試": 60, "材料評價+面試考核": 60, "口試及面試": 60, "筆試及面試": 40, "專業考試": 30 };
function radarVals(u) {
  const r = rankNum(u) === 9999 ? null : rankNum(u);
  return {
    prestige: r ? Math.max(0, Math.round(100 * (1 - (r - 1) / 500))) : 0,
    quota: u.quota2027 ? Math.round(100 * u.quota2027 / 130) : 0,
    hk: u.houkong2025 != null ? Math.round(100 * u.houkong2025 / 16) : 0,
    exam: u.exam ? (EXAM_FRIEND[u.exam] ?? 50) : 100,
    naPrestige: !r, naHk: u.houkong2025 == null,
  };
}
function drawRadarSVG(unis) {
  const AXES = ["軟科聲望", "保送名額", "濠江人氣", "考核友好"];
  const C = [230, 218], R = 150;
  const pt = (i, v) => { const a = (-90 + i * 90) * Math.PI / 180; return [C[0] + (v / 100) * R * Math.cos(a), C[1] + (v / 100) * R * Math.sin(a)]; };
  const ring = (g) => [0, 1, 2, 3].map(i => pt(i, g).map(n => n.toFixed(1)).join(",")).join(" ");
  const axisLines = [0, 1, 2, 3].map(i => { const [x, y] = pt(i, 100); return `<line x1="${C[0]}" y1="${C[1]}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)"/>`; }).join("");
  const ringLabels = [25, 50, 75, 100].map(g => `<text x="${C[0] + 5}" y="${(C[1] - (g / 100) * R - 4).toFixed(1)}" font-size="10" fill="#9ab0aa">${g}</text>`).join("");
  const axisLabels = [
    `<text x="${C[0]}" y="${C[1] - R - 26}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--text)">${AXES[0]}</text>`,
    `<text x="${C[0] + R + 12}" y="${C[1] + 4}" text-anchor="start" font-size="13" font-weight="600" fill="var(--text)">${AXES[1]}</text>`,
    `<text x="${C[0]}" y="${C[1] + R + 34}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--text)">${AXES[2]}</text>`,
    `<text x="${C[0] - R - 12}" y="${C[1] + 4}" text-anchor="end" font-size="13" font-weight="600" fill="var(--text)">${AXES[3]}</text>`,
  ].join("");
  const polys = unis.map((u, idx) => {
    const v = radarVals(u);
    const pts = [v.prestige, v.quota, v.hk, v.exam].map((val, i) => pt(i, val).map(n => n.toFixed(1)).join(",")).join(" ");
    const dots = [v.prestige, v.quota, v.hk, v.exam].map((val, i) => { const [x, y] = pt(i, val); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${COLORS[idx]}"/>`; }).join("");
    return `<polygon points="${pts}" fill="${COLORS[idx]}" fill-opacity=".16" stroke="${COLORS[idx]}" stroke-width="2.5" stroke-linejoin="round"/>${dots}`;
  }).join("");
  return `<svg viewBox="0 0 460 470" style="width:100%;max-width:470px;display:block;margin:0 auto" role="img" aria-label="大學雷達對比圖">
    ${[25, 50, 75, 100].map(g => `<polygon points="${ring(g)}" fill="none" stroke="var(--border)" stroke-width="1"/>`).join("")}
    ${axisLines}${ringLabels}${polys}${axisLabels}
  </svg>`;
}
function pageCompare() {
  const unis = compareIds().map(id => state.unis.find(u => u.id === id)).filter(Boolean);
  const slots = [0, 1, 2, 3].map(i => unis[i] ? unis[i].id : "");
  const sorted = [...state.unis].sort(byRank);
  $app.innerHTML = `
  <h1 style="margin-top:6px">大學對比 <small style="color:var(--muted);font-size:.85rem">最多 4 所 · 雷達圖並排比較</small></h1>
  <div class="filter-bar" style="position:static">
    ${slots.map((id, i) => `<select data-slot="${i}" style="min-width:180px">
      <option value="">選擇第 ${i + 1} 所…</option>
      ${sorted.map(u => `<option value="${esc(u.id)}" ${id === u.id ? "selected" : ""}>${esc(u.name)}（${esc(u.region)}）</option>`).join("")}
    </select>`).join("")}
    <button class="btn btn-outline" id="cmp-clear" style="padding:8px 14px">清空</button>
  </div>
  <div id="cmp-body"></div>`;
  document.querySelectorAll("select[data-slot]").forEach(sel =>
    sel.addEventListener("change", () => {
      const ids = compareIds();
      const cur = ids[Number(sel.dataset.slot)];
      if (cur) setCompareIds(ids.map(x => x === cur ? sel.value : x).filter(Boolean));
      else if (sel.value) setCompareIds([...ids, sel.value]);
      pageCompare();
    }));
  document.getElementById("cmp-clear").onclick = () => { setCompareIds([]); pageCompare(); };
  const body = document.getElementById("cmp-body");
  if (unis.length < 2) {
    body.innerHTML = `<div class="empty-tip">至少選擇 2 所大學開始對比。<br>也可以在「高校列表」點開任何大學，按「⚖️ 加入對比」。<br><a class="btn btn-primary" style="margin-top:14px" href="#/list">去高校列表 →</a></div>`;
    return;
  }
  body.innerHTML = `
  <div class="compare-grid">
    <div class="prose" style="padding:18px">${drawRadarSVG(unis)}
      <p style="font-size:.76rem;color:var(--muted);margin:10px 0 0">各軸 0–100 標準化：聲望＝主榜名次（第1名＝100，第500名≈0）；名額以 130 為滿；濠江人氣以 16 人為滿；考核友好＝免試 100／面試 70／材料審核+面試 60／筆試及面試 40／專業考試 30。未設榜或暫無資料以 0 繪製，僅供粗略比較。</p>
    </div>
    <div class="legend-col">${unis.map((u, i) => `
      <div class="legend-chip"><span class="dot" style="background:${COLORS[i]}"></span>
        <b>${esc(u.name)}</b><span style="color:var(--muted);font-size:.82rem">${esc(u.region)}</span>
        <button data-rm="${esc(u.id)}" title="移除">✕</button></div>`).join("")}
      <div class="notice" style="margin-top:10px">雷達圖只是概覽——選校前請看下方逐項數據與招生簡章。</div>
    </div>
  </div>
  <div class="table-wrap"><table class="data cmp-table"><thead><tr><th>項目</th>${unis.map(u => `<th>${esc(u.name)}</th>`).join("")}</tr></thead>
  <tbody>
    <tr><td>軟科 2026</td>${unis.map(u => { const rk = u.rank2026; return `<td>${rk ? `<b>${rk.rank}</b>${rk.board !== "主榜" ? ` <span style="color:var(--muted);font-size:.8rem">${esc(rk.board)}${rk.overall ? ` · 主榜線 ${rk.overall}` : ""}</span>` : ""}` : "未設榜"}</td>`; }).join("")}</tr>
    <tr><td>軟科 2025</td>${unis.map(u => { const rk = u.rank2025; return `<td>${rk ? `<b>${rk.rank}</b>${rk.board !== "主榜" ? ` <span style="color:var(--muted);font-size:.8rem">${esc(rk.board)}${rk.overall ? ` · 主榜線 ${rk.overall}` : ""}</span>` : ""}` : "未設榜"}</td>`; }).join("")}</tr>
    <tr><td>2027 保送名額</td>${unis.map(u => `<td><b>${u.quota2027 ?? "—"}</b></td>`).join("")}</tr>
    <tr><td>考核方式</td>${unis.map(u => `<td>${u.exam ? esc(u.exam) : "見招生簡章"}</td>`).join("")}</tr>
    <tr><td>另定要求</td>${unis.map(u => `<td style="font-size:.84rem">${u.extra ? esc(u.extra) : "—"}</td>`).join("")}</tr>
    <tr><td>2025 濠江中學保送</td>${unis.map(u => `<td>${u.houkong2025 != null ? `<b style="color:var(--primary)">${u.houkong2025}</b> 人` : "暫無資料"}</td>`).join("")}</tr>
    <tr><td>地區</td>${unis.map(u => `<td>${esc(u.region)}</td>`).join("")}</tr>
    <tr><td>標籤</td>${unis.map(u => `<td>${tagHTML(u.tags) || "—"}</td>`).join("")}</tr>
    <tr><td>簡章</td>${unis.map(u => `<td>${[u.brief2027 && `<a href="${esc(u.brief2027)}" target="_blank" rel="noopener">2027</a>`, u.brief2026 && `<a href="${esc(u.brief2026)}" target="_blank" rel="noopener">2026</a>`].filter(Boolean).join(" · ") || "—"}</td>`).join("")}</tr>
    <tr><td>官網</td>${unis.map(u => `<td>${u.website ? `<a href="${esc(u.website)}" target="_blank" rel="noopener">連結</a>` : "—"}</td>`).join("")}</tr>
    <tr><td>簡介</td>${unis.map(u => `<td style="font-size:.84rem">${esc(u.intro || "—")}</td>`).join("")}</tr>
  </tbody></table></div>`;
  body.querySelectorAll("[data-rm]").forEach(btn => btn.onclick = () => {
    setCompareIds(compareIds().filter(x => x !== btn.dataset.rm)); pageCompare();
  });
}

/* ---------- 頁面：保送流程 ---------- */
function pageFaq() {
  $app.innerHTML = `
  <h1 style="margin-top:6px">保送流程與常見問題</h1>
  <div class="notice">以下時間表為 <b>2027 屆</b>（現屆高三）官方安排，摘自 DSEDJ 保送生推薦系統；如有更新以 <a href="https://appl2.dsedj.gov.mo/ChinaUEnrollment/index.jsp" target="_blank" rel="noopener">DSEDJ 官網</a>為準。</div>
  <h2 class="section-title">六步流程</h2>
  <div class="timeline">
    <div class="tl-item"><h3>① 網上報名／學校推薦</h3><div class="when">查看資訊 2026-11-01 至 11-12</div><p>11-13 09:00 至 11-24 16:00 填寫報名資料並由學校推薦（一戶通登入）；11-25 至 11-27 16:00 可更改志願高校或專業。</p></div>
    <div class="tl-item"><h3>② 資料審查及保送考試</h3><div class="when">審查 2026-11-27 16:00 至 2027-01-15</div><p>保送考試：2027-01-16 09:00–18:00。各校另有面試／筆試安排者見其招生簡章。</p></div>
    <div class="tl-item"><h3>③ 公佈首輪錄取名單及徵集志願計劃</h3><div class="when">2027-01-17 08:00</div><p></p></div>
    <div class="tl-item"><h3>④ 徵集志願網上報名及高校諮詢會</h3><div class="when">2027-01-17 09:00–15:00（諮詢會 09:00–12:00）</div><p>首輪未獲錄取者可報讀仍有餘額的高校。</p></div>
    <div class="tl-item"><h3>⑤ 徵集志願資料審查及考試</h3><div class="when">審查 15:00–18:00 · 考試 18:00–21:00</div><p></p></div>
    <div class="tl-item"><h3>⑥ 公佈錄取總名單</h3><div class="when">2027-01-19 18:00</div><p></p></div>
  </div>
  <h2 class="section-title">常見問題</h2>
  <div class="faq-item"><h3>什麼是「保送」？</h3><p>內地高校部分名額專門招收澳門學生，經就讀中學推薦、通過該校的考核（免試／面試／筆試，各校不同）即獲錄取，不需參加全國聯招（港澳台聯招）或四校聯考成績排位。保送考試通常只考中、英、數基礎能力，難度低於聯招，錄取率極高。</p></div>
  <div class="faq-item"><h3>「保送名額」是什麼意思？</h3><p>是該高校預留給澳門保送生的推薦額度（全澳各校共享，非單一學校名額）。名額多不代表一定錄取，但通常競爭相對小。2027 年 128 所高校合共提供 1,481 個名額。</p></div>
  <div class="faq-item"><h3>志願怎麼填？</h3><p>報名時可填多個志願高校及專業，錄取按志願順序與各校考核結果進行；首輪未錄取可參加翌日（2027-01-17）的徵集志願。填報前建議用本站「高校列表」按排名、地區、考核方式篩選，再細閱目標學校的招生簡章。</p></div>
  <div class="faq-item"><h3>軟科排名是什麼？可信嗎？</h3><p>「軟科中國大學排名」由上海軟科教育信息咨詢有限公司發布，是內地最常被引用的大學排名之一。注意：主榜只排名綜合、理工、師範、農業、林業類高校，醫藥／財經／語言／政法／體育等請看對應分榜；藝術類院校不設榜。排名僅供參考，選校還應考慮專業實力、城市與個人規劃。</p></div>
  <div class="faq-item"><h3>「2025 濠江保送人數」是什麼？</h3><p>指 2025 屆濠江中學畢業生經內地聯校保送獲每所大學錄取的人數（全屆聯校保送共 210 人），根據濠江中學官網公佈的名單統計。它可以反映學長姐的去向偏好與該校對澳門生的「友好程度」，但每年波動大，僅供參考。</p></div>
  <div class="faq-item"><h3>我是其他學校的學生，可以看嗎？</h3><p>當然！名單、名額、簡章、排名對所有澳門學生一樣適用；濠江數據僅是「去向參考」。歡迎其他學校的同學按 README 的方法提交自己學校的保送數據。</p></div>`;
}

/* ---------- 頁面：關於 ---------- */
function pageAbout() {
  const c = state.meta?.counts || {};
  $app.innerHTML = `
  <h1 style="margin-top:6px">關於本站</h1>
  <div class="prose">
    <p>本站由澳門學生自發維護，把分散的升學資訊整合在一處：<b>官方保送名單與招生簡章、軟科排名、學長姐保送去向</b>。所有代碼與資料公開開源（代碼 MIT，資料 CC BY-SA 4.0）。</p>
    <h2>資料來源</h2>
    <table>
      <tr><th>資料</th><th>來源</th><th>更新方式</th></tr>
      <tr><td>保送高校名單、名額、考核要求、招生簡章</td><td><a href="https://appl2.dsedj.gov.mo/ChinaUEnrollment/index.jsp" target="_blank" rel="noopener">DSEDJ 保送生推薦系統</a></td><td>GitHub Actions 每月自動抓取</td></tr>
      <tr><td>軟科中國大學排名（2025／2026，主榜及分榜）</td><td><a href="https://www.shanghairanking.cn/rankings/bcur" target="_blank" rel="noopener">上海軟科</a>官方 API</td><td>GitHub Actions 每月自動抓取</td></tr>
      <tr><td>濠江中學 2025 聯校保送人數（210 人）</td><td><a href="https://houkong.edu.mo/hkhs/event/752" target="_blank" rel="noopener">濠江中學官網公佈名單</a></td><td>人工統計（原始名單圖片存於 docs/）</td></tr>
      <tr><td>各大學簡介</td><td>本項目撰寫並按官網核實</td><td>歡迎 PR 修正</td></tr>
    </table>
    <h2>數據現況</h2>
    <p>高校 ${c.universities} 所 · 名額 ${c.quotaTotal} 個 · 簡介 ${c.withIntro} 所 · 有軟科排名 ${c.withRank2026} 所 · 有濠江數據 ${c.withHoukong} 所。資料版本：<b>${esc((state.meta?.generatedAt || "").slice(0, 10))}</b>。</p>
    <h2>想補充／修正資料？</h2>
    <p>全部資料都是 <code>data/</code> 下的 JSON 檔，在 GitHub 網頁上點開檔案、按鉛筆圖示修改、提交 Pull Request 即可，完全不用寫程式。例如：補上自己學校的保送數據（<code>data/houkong-2025.json</code> 格式）、修正簡介、更新官網連結。</p>
    <h2>免責聲明</h2>
    <p>本站為非官方整理，僅供升學參考；一切資訊以 DSEDJ 及各大學官方最新公佈為準。簡章一律連結至 DSEDJ 官方檔案，本站不轉載其內容。本站不會發佈任何須登入官方系統才能查閱的資料。</p>
  </div>`;
}

/* ---------- 路由 ---------- */
function router() {
  const hash = location.hash || "#/";
  const route = hash.replace(/^#\//, "").split("/")[0];
  document.querySelectorAll("#nav a").forEach(a =>
    a.classList.toggle("active", a.dataset.route === "/" + route || (a.dataset.route === "/" && route === "")));
  $modalRoot.innerHTML = "";
  if (hash.startsWith("#/uni/")) { (state.lastListRoute === "#/table" ? pageTable() : pageList()); const u = state.unis.find(x => x.id === hash.slice(6)); if (u) showModal(u); return; }
  if (hash.startsWith("#/list")) { state.lastListRoute = hash; return pageList(); }
  if (hash.startsWith("#/table")) { state.lastListRoute = hash; return pageTable(); }
  if (hash.startsWith("#/compare")) return pageCompare();
  if (hash.startsWith("#/rankings")) return pageRankings();
  if (hash.startsWith("#/faq")) return pageFaq();
  if (hash.startsWith("#/about")) return pageAbout();
  return pageHome();
}

(async function init() {
  await loadData();
  window.addEventListener("hashchange", router);
  router();
})();
