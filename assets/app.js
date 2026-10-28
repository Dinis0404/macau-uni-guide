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
  if (!rk) return `<span class="rank-badge na" title="軟科中國大學排名未涵蓋該校（如藝術類、澳門高校）">${u.scheme !== "保送" ? esc(u.scheme) + "院校" : "軟科未設榜"}</span>`;
  const y = u.rank2026 ? 2026 : 2025;
  const suffix = rk.board !== "主榜" && rk.overall ? `（主榜線 ${rk.overall}）` : "";
  return `<span class="rank-badge" title="${esc(rankText(rk, y))}${suffix}">${esc(rankText(rk, y))}${suffix}</span>`;
}
function uniCardHTML(u, stagger = 0) {
  const hk = u.houkong2025;
  return `
  <article class="uni-card" data-id="${esc(u.id)}" style="--i:${stagger}">
    <div class="uni-card-top">
      <h3 class="uni-name">${esc(u.name)}</h3>
      <span class="uni-region">${esc(u.region)}</span>
    </div>
    <div class="tag-row">${u.scheme !== "保送" ? `<span class="tag tag-liangxiao">${u.scheme}</span>` : ""}${tagHTML(u.tags)}${u.scheme !== "兩校聯招" && u.brief2027 ? `<span class="tag tag-brief" title="已公佈 2027 招生簡章，點開可預覽">📄2027簡章</span>` : ""}${u.exam ? `<span class="exam-chip">📋 ${esc(u.exam)}</span>` : `<span class="exam-chip">📋 免筆試面試（以簡章為準）</span>`}</div>
    ${rankBadgeHTML(u)}
    <div class="uni-nums">
      <div class="uni-num"><small>${u.scheme !== "保送" ? "入讀途徑" : "2027 保送名額"}</small><b>${u.scheme !== "保送" ? u.scheme : (u.quota2027 ?? "—")}</b></div>
      <div class="uni-num"><small>2025 濠江保送</small><b class="${hk >= 5 ? "hk-hot" : ""}">${hk != null ? hk + " 人" : "暫無資料"}</b></div>
    </div>
  </article>`;
}

function showModal(u) {
  const hk = u.houkong2025;
  const links = [];
  if (u.scheme !== "保送") {
    if (u.admissionsUrl) links.push(`<a class="btn btn-primary" href="${esc(u.admissionsUrl)}" target="_blank" rel="noopener">📄 ${esc(u.admissionsLabel || "招生資訊")}</a>`);
    links.push(`<a class="btn btn-outline" href="#/other">聯招·聯考詳情 →</a>`);
  }
  if (!u.brief2027 && u.scheme === "保送") links.push(`<span class="btn btn-outline btn-reserved" title="DSEDJ 尚未上載該校 2027 簡章；公佈後本站每日自動更新，屆時可直接預覽">📖 2027 招生簡章 <span class="reserved-tag">未公佈</span></span>`);
  if (u.brief2027) links.push(`<span class="btn-group"><a class="btn btn-primary" href="javascript:void(0)" id="pv27">📖 預覽 2027 招生簡章</a><a class="mini-dl" href="${esc(u.brief2027)}" target="_blank" rel="noopener" title="直接下載 2027 簡章">⬇</a></span>`);
  if (u.brief2026) links.push(`<span class="btn-group"><a class="btn btn-outline" href="javascript:void(0)" id="pv26">📖 預覽 2026 簡章</a><a class="mini-dl" href="${esc(u.brief2026)}" target="_blank" rel="noopener" title="直接下載 2026 簡章">⬇</a></span>`);
  if (!u.brief2027 && u.majors2027?.length) links.push(`<span class="brief-hint">該校已公佈 2027 專業（見下方），簡章 PDF 尚未上載至 DSEDJ</span>`);
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
        <div class="fact"><small>${u.scheme !== "保送" ? "入讀途徑" : "2027 保送名額"}</small><b>${u.scheme !== "保送" ? u.scheme : u.quota2027 + " 人"}</b></div>
        <div class="fact"><small>考核方式</small><b>${u.exam ? esc(u.exam) : "見招生簡章"}</b></div>
        <div class="fact"><small>軟科 2026</small><b>${esc(rkFmt(rk26))}</b></div>
        <div class="fact"><small>軟科 2025</small><b>${esc(rkFmt(rk25))}</b></div>
        <div class="fact"><small>2025 濠江中學保送</small><b>${hk != null ? hk + " 人" : "暫無資料"}</b></div>
      </div>
      ${u.extra ? `<div class="extra-box"><b>另定要求：</b>${esc(u.extra)}</div>` : ""}
      ${u.majors2027?.length ? `<div class="majors-box"><div class="majors-head" id="majors-head">📋 2027 保送專業（${u.majors2027.length} 個）<span id="majors-toggle">展開 ▾</span></div><ul class="majors-list collapsed" id="majors-list">${u.majors2027.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}
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
  const pv27 = document.getElementById("pv27");
  if (pv27) pv27.onclick = () => showBrief(u, "2027");
  const pv26 = document.getElementById("pv26");
  if (pv26) pv26.onclick = () => showBrief(u, "2026");
  const mHead = document.getElementById("majors-head");
  if (mHead) mHead.onclick = () => {
    const list = document.getElementById("majors-list");
    const tog = document.getElementById("majors-toggle");
    list.classList.toggle("collapsed");
    tog.textContent = list.classList.contains("collapsed") ? "展開 ▾" : "收起 ▴";
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
    <div class="stat-card"><div class="stat-num">${c.universitiesBS ?? c.universities ?? "—"}</div><div class="stat-label">2027 參與保送高校</div></div>
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
  <h1 style="margin-top:6px">高校列表 <small style="color:var(--muted);font-size:.85rem">128 所保送（DSEDJ）＋聯招聯考院校</small></h1>
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
    ? list.map((u, i) => uniCardHTML(u, Math.min(i, 14))).join("")
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
  const inList = new Set(state.unis.filter(u => u.scheme === "保送").map(u => u.nameS));

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
      <td>${u.scheme !== "保送" ? "聯招" : `<b>${u.quota2027 ?? "—"}</b>`}</td>
      <td style="font-size:.85rem">${u.exam ? esc(u.exam) : "見招生簡章"}</td>
      <td>${u.houkong2025 != null ? `<b style="color:var(--primary)">${u.houkong2025}</b> 人` : `<span style="color:var(--muted)">暫無資料</span>`}</td>
      <td style="white-space:nowrap">${u.brief2027 ? `<a href="${esc(u.brief2027)}" target="_blank" rel="noopener" class="mini-link" onclick="event.stopPropagation()">2027</a>` : ""} ${u.brief2026 ? `<a href="${esc(u.brief2026)}" target="_blank" rel="noopener" class="mini-link" onclick="event.stopPropagation()">2026</a>` : ""}${!u.brief2027 && !u.brief2026 ? "—" : ""}</td>
    </tr>`).join("") || `<tr><td colspan="8" class="empty-tip">找不到符合的大學</td></tr>`;
  bindCards();
}

/* ---------- 頁面：大學對比 ---------- */
/* ---------- 頁面：大學對比 ---------- */
const COLORS = ["#0e7a5f", "#e07b28", "#8e44ad", "#2471a3"];
const EXAM_FRIEND = { "面試": 70, "材料審核+面試": 60, "材料評價+面試考核": 60, "口試及面試": 60, "筆試及面試": 40, "專業考試": 30 };
const examFriend = (u) => u.exam ? (EXAM_FRIEND[u.exam] ?? 50) : 100;
const rankNum = (u) => { const rk = u.rank2026 || u.rank2025 || {}; return rk.overall ?? rk.rank ?? 9999; };
const byRank = (a, b) => rankNum(a) - rankNum(b);
const briefParams = (url) => { const qs = new URL(url, location.href).searchParams; return { year: qs.get('year') || '', u_id: qs.get('u_id'), fileName: qs.get('fileName') || '' }; };
const briefProxyUrl = (u, y) => {
  const src = y === '2027' ? u.brief2027 : u.brief2026;
  const p = briefParams(src); const sp = new URLSearchParams();
  if (p.year) sp.set('year', p.year); sp.set('u_id', p.u_id); if (p.fileName) sp.set('fileName', p.fileName);
  return '/api/brief?' + sp.toString();
};

const setCompareIds = (ids) => localStorage.setItem(COMPARE_KEY, JSON.stringify([...new Set(ids)].slice(0, COMPARE_MAX)));

function pageCompare() {
  const unis = compareIds().map(id => state.unis.find(u => u.id === id)).filter(Boolean);
  $app.innerHTML = `
  <h1 style="margin-top:6px">大學對比 <small style="color:var(--muted);font-size:.85rem">最多 4 所 · 點「＋ 新增大學」用列表或搜尋挑選</small></h1>
  <div class="filter-bar" style="position:static">
    <button class="btn btn-primary" id="cmp-add" style="padding:9px 18px">＋ 新增大學</button>
    <div class="chip-row" id="chip-row" style="margin:0"></div>
    <button class="btn btn-outline" id="cmp-clear" style="padding:8px 14px;margin-left:auto">清空</button>
  </div>
  <div id="cmp-body"></div>`;
  document.getElementById("cmp-add").onclick = () => openUniPicker();
  document.getElementById("cmp-clear").onclick = () => { setCompareIds([]); pageCompare(); };
  renderChips();
  const body = document.getElementById("cmp-body");
  if (unis.length < 2) {
    body.innerHTML = `<div class="empty-tip">按「＋ 新增大學」加入至少 2 所（上限 4 所），支援搜尋與按地區／標籤／排名篩選。</div>`;
    return;
  }
  // 每校摘要卡
  const cards = `<div class="cmp-cards">${unis.map((u, i) => `
    <div class="cmp-card" style="border-top:4px solid ${COLORS[i]}">
      <div class="cmp-card-head"><b>${esc(u.name)}</b>
        <button data-rm="${esc(u.id)}" title="移除">✕</button></div>
      <div style="color:var(--muted);font-size:.82rem">${esc(u.region)} · ${(u.tags || []).join("、") || "—"}</div>
      <div class="cmp-card-facts">
        <span>${u.rank2026 ? `軟科 <b>${u.rank2026.rank}</b>${u.rank2026.board !== "主榜" ? `<span style="font-size:.75rem">（${esc(u.rank2026.board)}）</span>` : ""}` : "軟科未設榜"}</span>
        <span>${u.scheme !== "保送" ? u.scheme : `名額 <b>${u.quota2027 ?? "—"}</b>`}</span>
        <span>${u.exam ? esc(u.exam) : "免試／見簡章"}</span>
      </div>
    </div>`).join("")}</div>`;

  // 對比行：val 為數值（best: min/max），html 為顯示
  const row = (label, cells) => {
    const defined = cells.filter(c => c.val != null);
    let bestVal = null;
    if (defined.length && cells.some(c => c.best)) {
      const vals = defined.map(c => c.val);
      bestVal = cells.some(c => c.best === "min") ? Math.min(...vals) : Math.max(...vals);
    }
    return `<tr><td>${label}</td>${cells.map(c => {
      const isBest = c.val != null && bestVal != null && c.val === bestVal && defined.length > 1;
      return `<td class="${isBest ? "best" : ""}">${isBest ? "★ " : ""}${c.html}</td>`;
    }).join("")}</tr>`;
  };
  const rkCell = (rk) => rk ? { val: rk.overall ?? rk.rank, html: `<b>${rk.rank}</b>${rk.board !== "主榜" ? ` <span style="color:var(--muted);font-size:.8rem">${esc(rk.board)}${rk.overall ? ` · 主榜線 ${rk.overall}` : ""}</span>` : ""}` } : { html: "未設榜" };
  const table = `<div class="table-wrap"><table class="data cmp-table"><thead><tr><th style="width:130px">項目</th>${unis.map(u => `<th>${esc(u.name)}</th>`).join("")}</tr></thead><tbody>
    ${row("軟科 2026（越前越好）", unis.map(u => rkCell(u.rank2026)).map(c => ({ ...c, best: "min" })))}
    ${row("軟科 2025", unis.map(u => rkCell(u.rank2025)))}
    ${row("2027 保送名額（越多越好）", unis.map(u => ({ val: u.scheme !== "保送" ? null : (u.quota2027 ?? null), html: u.scheme !== "保送" ? u.scheme + "（不入保送）" : `<b>${u.quota2027 ?? "—"}</b>`, best: u.scheme !== "保送" ? null : "max" })))}
    ${row("考核方式（越免試越輕鬆）", unis.map(u => ({ val: examFriend(u), html: u.exam ? esc(u.exam) : "免試／見簡章", best: "max" })))}
    ${row("另定要求", unis.map(u => ({ html: u.extra ? esc(u.extra) : "—" })))}
    ${row("2027 保送專業（已公佈）", unis.map(u => ({ val: u.majors2027?.length || null, html: u.majors2027?.length ? `<b>${u.majors2027.length}</b> 個 · <a href="javascript:void(0)" class="cmp-majors" data-id="${esc(u.id)}">查看</a>` : "暫未公佈", best: "max" })))}
    ${row("2025 濠江中學保送", unis.map(u => ({ val: u.houkong2025 ?? null, html: u.houkong2025 != null ? `<b style="color:var(--primary)">${u.houkong2025}</b> 人` : "暫無資料", best: "max" })))}
    <tr><td>地區</td>${unis.map(u => `<td>${esc(u.region)}</td>`).join("")}</tr>
    <tr><td>標籤</td>${unis.map(u => `<td>${tagHTML(u.tags) || "—"}</td>`).join("")}</tr>
    <tr><td>招生簡章</td>${unis.map(u => `<td>${[u.brief2027 && `<a href="javascript:void(0)" class="cmp-brief" data-id="${esc(u.id)}" data-y="2027">預覽 2027</a>`, u.brief2026 && `<a href="javascript:void(0)" class="cmp-brief" data-id="${esc(u.id)}" data-y="2026">2026</a>`, !u.brief2027 && `<span style="color:var(--muted);font-size:.82rem">2027 未公佈</span>`].filter(Boolean).join(" · ") || "—"}</td>`).join("")}</tr>
    <tr><td>官網</td>${unis.map(u => `<td>${u.website ? `<a href="${esc(u.website)}" target="_blank" rel="noopener">連結</a>` : "—"}</td>`).join("")}</tr>
    <tr><td>簡介</td>${unis.map(u => `<td style="font-size:.84rem">${esc(u.intro || "—")}</td>`).join("")}</tr>
  </tbody></table></div>
  <p style="color:var(--muted);font-size:.82rem">★ = 該行中對學生最有利的選項；「暫無資料／暫未公佈」不參與評比。</p>`;
  body.innerHTML = cards + table;

  body.querySelectorAll("[data-rm]").forEach(btn => btn.onclick = () => {
    setCompareIds(compareIds().filter(x => x !== btn.dataset.rm)); pageCompare();
  });
  body.querySelectorAll(".cmp-brief").forEach(a => a.onclick = () => {
    const u = state.unis.find(x => x.id === a.dataset.id); if (u) showBrief(u, a.dataset.y);
  });
  body.querySelectorAll(".cmp-majors").forEach(a => a.onclick = () => {
    const u = state.unis.find(x => x.id === a.dataset.id);
    if (u) showMajorsModal(u);
  });
}
function addCompare(id) {
  const ids = compareIds();
  if (ids.includes(id) || ids.length >= COMPARE_MAX) return false;
  setCompareIds([...ids, id]);
  return true;
}
function renderChips() {
  const row = document.getElementById("chip-row");
  if (!row) return;
  const unis = compareIds().map(id => state.unis.find(u => u.id === id)).filter(Boolean);
  row.innerHTML = unis.length ? unis.map((u, i) => `
    <span class="cmp-chip"><span class="dot" style="background:${COLORS[i]}"></span>${esc(u.name)}
      <button data-rm="${esc(u.id)}">✕</button></span>`).join("") : `<span style="color:var(--muted);font-size:.88rem">尚未選擇大學</span>`;
  row.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { setCompareIds(compareIds().filter(x => x !== b.dataset.rm)); pageCompare(); });
}
/* 總表式選校器：搜尋 + 地區/標籤篩選 + 排序，點行加入 */
function openUniPicker() {
  const st = { q: "", region: "", tag: "", sort: "rank" };
  const regions = [...new Set(state.unis.map(u => u.region))];
  const picked = () => compareIds().map(id => state.unis.find(u => u.id === id)).filter(Boolean);
  $modalRoot.innerHTML = `
  <div class="modal-backdrop" id="picker-backdrop">
    <div class="modal picker-modal">
      <button class="modal-close" id="picker-close" aria-label="關閉">✕</button>
      <h2 style="margin:0 0 10px">新增大學到對比 <small style="color:var(--muted);font-size:.85rem">已選 <span id="pk-count">${picked().length}</span>/4</small></h2>
      <div class="filter-bar" style="position:static;padding:10px">
        <input type="search" id="pk-q" placeholder="搜尋大學（繁簡均可）…">
        <select id="pk-region"><option value="">全部地區</option>${regions.map(r => `<option>${esc(r)}</option>`).join("")}</select>
        <select id="pk-tag">
          <option value="">全部標籤</option><option value="985">985</option><option value="211">211</option>
          <option value="雙一流">雙一流</option><option value="none">非 985/211</option>
        </select>
        <select id="pk-sort">
          <option value="rank">按軟科排名</option><option value="quota">按 2027 名額</option>
          <option value="hk">按濠江保送人數</option><option value="name">按名稱</option>
        </select>
      </div>
      <div class="picker-list" id="pk-list"></div>
    </div>
  </div>`;
  const close = () => { $modalRoot.innerHTML = ""; renderChips(); };
  document.getElementById("picker-close").onclick = () => { close(); pageCompare(); };
  document.getElementById("picker-backdrop").onclick = (e) => { if (e.target.id === "picker-backdrop") { close(); pageCompare(); } };
  const rk = u => rankNum(u);
  const renderList = () => {
    const q = st.q.trim().toLowerCase();
    let list = state.unis.filter(u => {
      if (q && !u.search.toLowerCase().includes(q)) return false;
      if (st.region && u.region !== st.region) return false;
      if (st.tag === "none" && u.tags.some(t => t === "985" || t === "211")) return false;
      else if (st.tag && st.tag !== "none" && !u.tags.includes(st.tag)) return false;
      return true;
    });
    if (st.sort === "rank") list.sort((a, b) => rk(a) - rk(b) || (b.quota2027 || 0) - (a.quota2027 || 0));
    if (st.sort === "quota") list.sort((a, b) => (b.quota2027 || 0) - (a.quota2027 || 0) || rk(a) - rk(b));
    if (st.sort === "hk") list.sort((a, b) => (b.houkong2025 ?? -1) - (a.houkong2025 ?? -1) || rk(a) - rk(b));
    if (st.sort === "name") list.sort((a, b) => a.nameS.localeCompare(b.nameS, "zh-Hans"));
    const ids = compareIds();
    document.getElementById("pk-list").innerHTML = list.map(u => {
      const added = ids.includes(u.id);
      const full = ids.length >= COMPARE_MAX && !added;
      return `<div class="pk-row ${added ? "added" : ""}" data-id="${esc(u.id)}">
        <div><b>${esc(u.name)}</b> <span style="color:var(--muted);font-size:.8rem">${esc(u.region)}</span>
          <div style="font-size:.8rem;color:var(--muted)">${u.rank2026 ? `軟科 ${u.rank2026.rank}${u.rank2026.board !== "主榜" ? `（${esc(u.rank2026.board)}）` : ""}` : "未設榜"} · ${u.scheme !== "保送" ? u.scheme + " · " : "名額 " + (u.quota2027 ?? "—") + " · "}${u.exam || "免試／見簡章"}${u.brief2027 ? ' · <span style="color:var(--primary)">📄2027簡章</span>' : ""}</div></div>
        <span class="pk-action">${added ? "✓ 已加入" : full ? "額滿" : "＋ 加入"}</span>
      </div>`;
    }).join("") || `<div class="empty-tip">找不到符合的大學</div>`;
    document.querySelectorAll(".pk-row").forEach(el => el.addEventListener("click", () => {
      if (el.classList.contains("added")) return;
      if (!addCompare(el.dataset.id)) return;
      document.getElementById("pk-count").textContent = compareIds().length;
      el.classList.add("added");
      el.querySelector(".pk-action").textContent = "✓ 已加入";
      renderChips();
      if (compareIds().length >= COMPARE_MAX) setTimeout(() => { close(); pageCompare(); }, 450);
    }));
  };
  ["pk-q", "pk-region", "pk-tag", "pk-sort"].forEach(id => {
    const map = { "pk-q": "q", "pk-region": "region", "pk-tag": "tag", "pk-sort": "sort" };
    document.getElementById(id).addEventListener("input", (e) => { st[map[id]] = e.target.value; renderList(); });
  });
  renderList();
}


/* 專業快速查看彈窗 */
function showMajorsModal(u) {
  $modalRoot.innerHTML = `
  <div class="modal-backdrop" id="mj-backdrop">
    <div class="modal" role="dialog" aria-modal="true">
      <button class="modal-close" id="mj-close" aria-label="關閉">✕</button>
      <h2>📋 ${esc(u.name)} · 2027 保送專業</h2>
      <div class="sub">共 ${u.majors2027.length} 個 · 來源：DSEDJ 專業查詢系統</div>
      <ul class="majors-list" style="font-size:.92rem;max-height:55vh;overflow:auto">${u.majors2027.map(m => { const p = parseMajor(m); return `<li>${esc(p.text)}${p.years ? ` <span class="major-years">${p.years} 年制</span>` : ""}</li>`; }).join("")}</ul>
      <div class="link-row"><a class="btn btn-outline" href="javascript:void(0)" id="mj-uni">查看該校完整詳情</a></div>
    </div>
  </div>`;
  const close = () => { $modalRoot.innerHTML = ""; };
  document.getElementById("mj-close").onclick = close;
  document.getElementById("mj-backdrop").onclick = (e) => { if (e.target.id === "mj-backdrop") close(); };
  document.getElementById("mj-uni").onclick = () => { close(); location.hash = "#/uni/" + u.id; };
}

/* ---------- 簡章預覽（站內 iframe + 雙欄對比） ---------- */
function showBrief(u, year, dualWith = null) {
  const src = year === "2027" ? u.brief2027 : u.brief2026;
  if (!src) return;
  const otherYear = year === "2027" ? "2026" : "2027";
  const withBrief = state.unis.filter(x => (year === "2027" ? x.brief2027 : x.brief2026) && x.id !== u.id).sort(byRank);
  // dualWith: null=單欄；"pick"=右欄顯示選校器；大學物件=右欄顯示該校簡章
  const picking = dualWith === "pick";
  const second = picking ? null : dualWith;
  $modalRoot.innerHTML = `
  <div class="modal-backdrop brief-backdrop" id="brief-backdrop">
    <div class="brief-panel">
      <div class="brief-bar">
        <span class="pane-tag">${dualWith ? "左欄" : "簡章"}</span>
        <b>${esc(u.name)} · ${year} 招生簡章</b>
        ${u["brief" + otherYear] ? `<button class="chip-btn" id="brief-year">切換到 ${otherYear} 版</button>` : ""}
        <button class="chip-btn" id="brief-dual">${dualWith ? "退出對比" : "📚 雙欄對比"}</button>
        ${dualWith && !picking ? `<button class="chip-btn" id="brief-swap">🔄 左右交換</button>` : ""}
        <a class="chip-btn" href="${esc(src)}" target="_blank" rel="noopener">⬇ 直接下載</a>
        <span class="brief-hint">按 Esc 或「✕ 關閉」離開</span>
        <button class="chip-btn close-big" id="brief-close">✕ 關閉</button>
      </div>
      <div class="brief-body ${dualWith ? "dual" : ""}" id="brief-body">
        <div class="brief-pane">
          <div class="iframe-wrap loading"><iframe src="${esc(briefProxyUrl(u, year))}" title="${esc(u.name)} ${year} 簡章"></iframe></div>
        </div>
        ${dualWith ? `
        <div class="brief-pane">
          <div class="brief-bar sub">
            <span class="pane-tag">右欄</span>
            ${picking
              ? `<b style="font-size:.9rem">選擇要比較的大學</b>`
              : `<select id="brief-pick">${withBrief.map(x => `<option value="${esc(x.id)}" ${x.id === second.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`}
            <button class="chip-btn" id="brief-second-close">✕</button>
          </div>
          ${picking
            ? `<div class="brief-pick-list" id="brief-pick-list"></div>`
            : `<div class="iframe-wrap loading"><iframe src="${esc(briefProxyUrl(second, year))}" title="右欄簡章"></iframe></div>`}
        </div>` : ""}
      </div>
    </div>
  </div>`;
  const close = () => { $modalRoot.innerHTML = ""; };
  document.getElementById("brief-close").onclick = close;
  document.getElementById("brief-backdrop").onclick = (e) => { if (e.target.id === "brief-backdrop") close(); };
  const yBtn = document.getElementById("brief-year");
  if (yBtn) yBtn.onclick = () => showBrief(u, otherYear, dualWith && dualWith !== "pick" && dualWith["brief" + otherYear] ? dualWith : null);
  document.getElementById("brief-dual").onclick = () => showBrief(u, year, dualWith ? null : "pick");
  const sc = document.getElementById("brief-second-close");
  if (sc) sc.onclick = () => showBrief(u, year, null);
  const swap = document.getElementById("brief-swap");
  if (swap) swap.onclick = () => showBrief(second, year, u);
  const pick = document.getElementById("brief-pick");
  if (pick) pick.onchange = () => showBrief(u, year, state.unis.find(x => x.id === pick.value));
  // 右欄選校器：搜尋 + 列表
  const pickList = document.getElementById("brief-pick-list");
  if (pickList) {
    let q = "";
    const render = () => {
      const hits = withBrief.filter(x => !q || (x.name + x.nameS + x.region).toLowerCase().includes(q));
      pickList.innerHTML = `
        <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
          <input type="search" id="bp-q" placeholder="搜尋大學（繁簡均可）…" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:9px;background:var(--bg);color:var(--text);font-size:.92rem">
        </div>
        ${hits.map(x => `<div class="pk-row" data-id="${esc(x.id)}"><div><b>${esc(x.name)}</b>
          <span style="color:var(--muted);font-size:.8rem">${esc(x.region)} · ${x.rank2026 ? `軟科 ${x.rank2026.rank}` : "未設榜"}</span></div>
          <span class="pk-action">選這所 →</span></div>`).join("") || '<div class="empty-tip">找不到</div>'}`;
      pickList.querySelector("#bp-q").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); render(); pickList.querySelector("#bp-q").focus(); const inp = pickList.querySelector("#bp-q"); inp.setSelectionRange(inp.value.length, inp.value.length); });
      pickList.querySelectorAll(".pk-row").forEach(el => el.onclick = () => showBrief(u, year, state.unis.find(x => x.id === el.dataset.id)));
    };
    render();
  }
  // iframe 載入指示
  document.querySelectorAll(".iframe-wrap iframe").forEach(f => f.addEventListener("load", () => f.parentElement.classList.remove("loading")));
  const onKey = (e) => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);
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
    <h2>更新日誌</h2>
    <p>每次自動更新的變化記錄見 <a href="#/updatelog">更新日誌頁</a>（#updatelog）。</p>
    <h2>數據現況</h2>
    <p>高校 ${c.universities} 所 · 名額 ${c.quotaTotal} 個 · 簡介 ${c.withIntro} 所 · 有軟科排名 ${c.withRank2026} 所 · 有濠江數據 ${c.withHoukong} 所。資料版本：<b>${esc((state.meta?.generatedAt || "").slice(0, 10))}</b>。</p>
    <h2>想補充／修正資料？</h2>
    <p>全部資料都是 <code>data/</code> 下的 JSON 檔，在 GitHub 網頁上點開檔案、按鉛筆圖示修改、提交 Pull Request 即可，完全不用寫程式。例如：補上自己學校的保送數據（<code>data/houkong-2025.json</code> 格式）、修正簡介、更新官網連結。</p>
    <h2>免責聲明</h2>
    <p>本站為非官方整理，僅供升學參考；一切資訊以 DSEDJ 及各大學官方最新公佈為準。簡章一律連結至 DSEDJ 官方檔案，本站不轉載其內容。本站不會發佈任何須登入官方系統才能查閱的資料。</p>
  </div>`;
}


/* ---------- 頁面：保送專業 ---------- */
const majorsState = { q: "", region: "" };
function parseMajor(m) {
  const mm = m.match(/\[([0-9]+)\]\s*$/);
  const years = mm ? mm[1] : null;
  return { text: m.replace(/\s*\[[0-9]+\]\s*$/, ""), years };
}
function pageMajors() {
  const withM = state.unis.filter(u => u.majors2027?.length).sort(byRank);
  const without = state.unis.filter(u => u.scheme === "保送" && !u.majors2027?.length);
  $app.innerHTML = `
  <h1 style="margin-top:6px">2027 保送專業 <small style="color:var(--muted);font-size:.85rem">${withM.length} / ${state.unis.length} 所已公佈 · 每日自動更新</small></h1>
  <div class="notice">資料來自 DSEDJ「查詢內地高校招生專業」系統（首階段）。各大學陸續錄入中——下面「尚未公佈」的學校，公佈後會自動出現。括號內為專業組包含的方向，[數字] 為學制年數。</div>
  <div class="filter-bar">
    <input type="search" id="mj-q" placeholder="搜專業關鍵字（如：臨床、會計、電腦）或大學名…" value="${esc(majorsState.q)}">
    <select id="mj-region"><option value="">全部地區</option>${[...new Set(state.unis.map(u => u.region))].map(r => `<option ${majorsState.region === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
    <div class="result-count" id="mj-count"></div>
  </div>
  <div id="mj-list"></div>`;
  const render = () => {
    const q = majorsState.q.trim().toLowerCase();
    const list = withM.filter(u => {
      if (majorsState.region && u.region !== majorsState.region) return false;
      if (!q) return true;
      const hay = (u.name + u.nameS + u.majors2027.join(" ")).toLowerCase();
      return hay.includes(q);
    });
    document.getElementById("mj-count").textContent = `符合 ${list.length} 所`;
    document.getElementById("mj-list").innerHTML = list.map(u => {
      const hits = q ? u.majors2027.filter(m => (m + u.name).toLowerCase().includes(q)) : u.majors2027;
      return `<div class="major-card">
        <div class="major-head" data-id="${esc(u.id)}">
          <b>${esc(u.name)}</b>
          <span style="color:var(--muted);font-size:.84rem">${esc(u.region)} · ${u.rank2026 ? `軟科 ${u.rank2026.rank}` : "未設榜"} · 名額 ${u.quota2027 ?? "—"}</span>
          <span class="major-count">${u.majors2027.length} 個專業</span>
        </div>
        <ul class="majors-list">${hits.map(m => { const p = parseMajor(m); return `<li>${esc(p.text)}${p.years ? ` <span class="major-years">${p.years} 年制</span>` : ""}</li>`; }).join("")}</ul>
      </div>`;
    }).join("") || `<div class="empty-tip">找不到符合的專業／大學</div>`;
    if (!q && !majorsState.region) {
      document.getElementById("mj-list").insertAdjacentHTML("beforeend", `
        <h2 class="section-title">⏳ 尚未公佈專業的學校（${without.length} 所）<small>公佈後自動加入</small></h2>
        <div class="tag-row">${without.sort((a, b) => byRank(a, b)).map(u => `<span class="cmp-chip" style="cursor:pointer" data-goto="${esc(u.id)}">${esc(u.name)}${u.brief2027 ? " 📄" : ""}</span>`).join("")}</div>`);
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
  $app.innerHTML = `
  <h1 style="margin-top:6px">更新日誌 <small style="color:var(--muted);font-size:.85rem">每次自動資料更新的變化記錄</small></h1>
  <div class="notice">名單公佈期（至 2026 年 11 月初）每日更新，之後每月更新；只有資料有變化才會產生記錄。</div>
  <div id="ul-body"><div class="empty-tip">載入中…</div></div>`;
  let log = [];
  try { log = await fetch("data/updatelog.json").then(r => r.json()); } catch {}
  document.getElementById("ul-body").innerHTML = log.length ? log.map(e => `
    <div class="ul-entry">
      <div class="ul-date">🗓 ${esc(e.date)} <span style="color:var(--muted);font-size:.8rem">· ${e.counts ? `${e.counts.universities} 所高校 · ${e.counts.withBrief2027 ?? "—"} 所已有簡章 · ${e.counts.withMajors ?? "—"} 所已有專業` : ""}</span></div>
      <ul class="majors-list">${(e.changes || []).map(c => `<li>${esc(c)}</li>`).join("")}</ul>
    </div>`).join("") : `<div class="empty-tip">暫無記錄</div>`;
}

/* ---------- 頁面：聯招·聯考（其他升學途徑） ---------- */
const OTHER_ADMIT = [
  "南開大學", "復旦大學", "浙江大學", "廈門大學", "華僑大學", "福州大學",
  "武漢大學", "華中科技大學", "華中師範大學", "湖北大學", "中南大學",
  "中山大學", "暨南大學", "華南師範大學", "廣州大學", "華南理工大學",
  "華南農業大學", "西安交通大學", "中國地質大學（武漢）", "香港中文大學（深圳）",
  "武漢理工大學", "中南財經政法大學",
];
function pageOther() {
  const bsNames = new Set(state.unis.map(u => u.name));
  $app.innerHTML = `
  <h1 style="margin-top:6px">聯招·聯考 <small style="color:var(--muted);font-size:.85rem">保送以外，澳門生往內地及本地升學的主要途徑</small></h1>
  <div class="notice">本頁整理 <b>兩校聯招</b>（暨南大學、華僑大學）與 <b>澳門四校聯考</b> 的要點，並附四條升學途徑對比。各項日期以官方最新公佈為準。</div>

  <h2 class="section-title">🏛 兩校聯招（暨南大學＋華僑大學）</h2>
  <div class="prose">
    <p><b>暨南大學</b>（廣州，僑校第一名）與 <b>華僑大學</b>（泉州／廈門）每年聯合舉辦「招收港澳台僑學生入學考試」，俗稱<b>兩校聯招</b>，是澳門生保送以外最熱門的內地升學途徑之一——名額多、門檻較全國聯招友好，且兩校均設有針對澳門生的<b>免試錄取</b>渠道（依中學成績等審核，詳情見兩校招生簡章）。</p>
    <h3>考試形式（3＋X）</h3>
    <p>必考三科：<b>中國語文、英語、數學</b>；另選一科 X——文科選歷史／地理，理科選物理／化學／生物（報醫學類須加選化學＋生物或物理＋生物）。</p>
    <h3>參考時間表（以 2026 屆為例，2027 屆另行公佈）</h3>
    <div class="timeline">
      <div class="tl-item"><h3>網上報名</h3><div class="when">3 月上中旬（2026 年為 3 月 1–15 日）</div><p>登入兩校聯招系統 <a href="https://lxlz.jnu.edu.cn" target="_blank" rel="noopener">lxlz.jnu.edu.cn</a> 報名；考場設澳門、香港、廣州、廈門等地。</p></div>
      <div class="tl-item"><h3>考試</h3><div class="when">5 月底（2026 年為 5 月 30–31 日）</div><p>澳門設考點，本地應考。</p></div>
      <div class="tl-item"><h3>放榜及錄取</h3><div class="when">7 月上中旬</div><p>分數線與錄取結果於兩校招生網公佈。</p></div>
    </div>
    <p style="font-size:.88rem">官方資訊：<a href="https://lxlz.jnu.edu.cn" target="_blank" rel="noopener">兩校聯招報名系統</a> · <a href="https://zsc.hqu.edu.cn/zsxx.htm" target="_blank" rel="noopener">華僑大學招生處</a> · <a href="https://www.jnu.edu.cn" target="_blank" rel="noopener">暨南大學</a></p>
  </div>

  <h2 class="section-title">🏫 澳門四校聯考（本地四校）</h2>
  <div class="prose">
    <p>全名「<b>澳門四高校聯合入學考試（語言科及數學科）</b>」，由 <b>澳門大學、澳門理工大學、澳門旅遊大學、澳門科技大學</b> 四所本地高校聯合舉辦，考<b>語文、數學、外語（英語）</b>三科——按報考課程選考，不必全科報考。聯考成績是四校共同的「參考工具」，各校再按自設考核（面試／術科／學科考試）擇優錄取。</p>
    <h3>參考時間表（2026/2027 學年，據澳大公佈）</h3>
    <div class="timeline">
      <div class="tl-item"><h3>四校聯考報名</h3><div class="when">2026 年 1 月 2 日 – 1 月 16 日</div><p>須<b>獨立網上報名</b>，並分別向擬報讀的高校遞交入學申請。</p></div>
      <div class="tl-item"><h3>直接入學報名</h3><div class="when">2026 年 2 月 3 日 – 4 月 9 日</div><p>不走聯考成績、以其他成就（競賽、面試等）直接申請的渠道。</p></div>
      <div class="tl-item"><h3>聯考考試</h3><div class="when">約 3 月底 – 4 月初（歷年為 3 月 30 日前後）</div><p>准考證於考前於網上系統下載。</p></div>
    </div>
    <p style="font-size:.88rem">各校招生官方網頁：<a href="https://reg.um.edu.mo" target="_blank" rel="noopener">澳門大學</a> · <a href="https://www.mpu.edu.mo" target="_blank" rel="noopener">澳門理工大學</a> · <a href="https://www.mtu.edu.mo" target="_blank" rel="noopener">澳門旅遊大學</a> · <a href="https://www.must.edu.mo" target="_blank" rel="noopener">澳門科技大學</a></p>
  </div>

  <h2 class="section-title">🎯 憑四校聯考成績報考內地 22 所高校（2026/2027 學年）</h2>
  <div class="prose">
    <p>經國家教育部批准，<b>2026/2027 學年共 22 所內地高校</b>採認澳門四校聯考成績招生（本學年新增武漢理工大學、中南財經政法大學）。持有效澳門居民身份證及<b>港澳居民來往內地通行證（回鄉證）</b>的應屆聯考考生，可在 <b>5–6 月</b>各校招生期內向目標高校提交聯考成績及文件申請，各校可再安排科目考試或面試，<b>7 月中下旬</b>放榜。</p>
    <div class="tag-row" style="margin:10px 0">${OTHER_ADMIT.map(n => `<span class="tag" style="background:var(--primary-light);color:var(--primary-dark);font-size:.82rem;padding:4px 12px">${n}${bsNames.has(n) ? ' <span title="該校同時參與保送計劃" style="opacity:.75">⭐可保送</span>' : ''}</span>`).join("")}</div>
    <p style="font-size:.82rem;color:var(--muted)">⭐ = 該校同時參與保送計劃（可多途徑報考）。名單來源：教青局及媒體公佈（2026/2027 學年 22 所）。</p>
  </div>

  <h2 class="section-title">🧭 四條途徑怎麼選？</h2>
  <div class="table-wrap"><table class="data"><thead><tr><th>途徑</th><th>報名</th><th>考試／評核</th><th>放榜</th><th>去向</th></tr></thead><tbody>
    <tr><td><b>內地保送</b>（本站主題）</td><td>2026 年 11 月（經學校推薦）</td><td>2027 年 1 月；多校免試或僅面試</td><td>2027 年 1 月 19 日</td><td>128 所內地高校</td></tr>
    <tr><td><b>兩校聯招</b></td><td>2027 年 3 月</td><td>2027 年 5 月底 · 中文／英數＋X</td><td>2027 年 7 月</td><td>暨南大學、華僑大學</td></tr>
    <tr><td><b>四校聯考 → 內地 22 所</b></td><td>2026 年 1 月（聯考）</td><td>2026 年 3 月底 – 4 月初</td><td>各校 7 月中下旬</td><td>22 所內地高校（見上）</td></tr>
    <tr><td><b>四校聯考 → 本地四校</b></td><td>2026 年 1 月（聯考）＋各校申請</td><td>3 月底 – 4 月初＋校內考核</td><td>各校自定</td><td>澳大、理工、旅遊、科大</td></tr>
    <tr><td>全國聯招（港澳台聯招）</td><td>約 3 月</td><td>約 5 月 · 五科</td><td>6 月</td><td>內地大部分高校</td></tr>
  </tbody></table></div>
  <div class="notice" style="margin-top:14px"><b>提示：</b>保送放榜最早（1 月）、且多數高校免試，是「穩陣之選」；兩校聯招與四校聯考可以作為保送以外的後備或補充——多條途徑同時準備在澳門完全正常。所有日期以各官方機構最新公佈為準。</div>
  <p style="color:var(--muted);font-size:.8rem">資料來源：兩校聯招系統、華僑大學招生處、澳門大學招生資訊、教青局及本地媒體公佈（整理於 2026-10-28）。</p>`;
}

/* ---------- 路由 ---------- */
function router() {
  const hash = location.hash || "#/";
  const route = hash.replace(/^#\//, "").split("/")[0];
  document.querySelectorAll("#nav a").forEach(a =>
    a.classList.toggle("active", a.dataset.route === "/" + route || (a.dataset.route === "/" && route === "")));
  $modalRoot.innerHTML = "";
  $app.classList.remove("page-anim");
  void $app.offsetWidth;
  $app.classList.add("page-anim");
  if (hash.startsWith("#/uni/")) { (state.lastListRoute === "#/table" ? pageTable() : pageList()); const u = state.unis.find(x => x.id === hash.slice(6)); if (u) showModal(u); return; }
  if (hash.startsWith("#/list")) { state.lastListRoute = hash; return pageList(); }
  if (hash.startsWith("#/table")) { state.lastListRoute = hash; return pageTable(); }
  if (hash.startsWith("#/compare")) return pageCompare();
  if (hash.startsWith("#/majors")) return pageMajors();
  if (hash.startsWith("#/updatelog")) return pageUpdatelog();
  if (hash.startsWith("#/other")) return pageOther();
  if (hash.startsWith("#/rankings")) return pageRankings();
  if (hash.startsWith("#/faq")) return pageFaq();
  if (hash.startsWith("#/about")) return pageAbout();
  return pageHome();
}

/* ---------- 深色／淺色模式 ---------- */
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
  await loadData();
  window.addEventListener("hashchange", router);
  router();
})();
