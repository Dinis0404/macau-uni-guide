/* 深度指南模組（#/guide）— 由 app.js 路由調用 window.pageGuide */
(function () {
  "use strict";
  const st = { q: "", region: "", scheme: "", sort: "rank" };
  let DETAILS = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const rkNum = (u) => {
    const rk = u.rank2026 || u.rank2025 || {};
    return (rk.overall ?? rk.rank) ?? (u.rankWorld2025 ? 3000 : 9999);
  };
  const sec = (t, v) => v ? `<div class="g-sec"><h4>${t}</h4><p>${esc(v)}</p></div>` : "";

  window.pageGuide = async function (app, state) {
    if (!DETAILS) {
      try { DETAILS = await fetch("data/details.json").then(r => r.json()); }
      catch { DETAILS = {}; }
    }
    const unis = state.unis.map(u => Object.assign({}, u, { d: DETAILS[u.nameS] || {} }));
    const regions = [...new Set(unis.map(u => u.region))];

    app.innerHTML = `
    <h1 style="margin-top:6px">深度指南 <small style="color:var(--muted);font-size:.85rem">135 所：定位／校區／地理環境／專業亮點／綜合評價 ＋ 2027 官方專業清單</small></h1>
    <div class="notice">資料整理於 2026-11，供升學參考；校區與城市描述如有出入以官方為準。專業清單為 DSEDJ 官方公佈之 2027 保送專業。</div>
    <div class="filter-bar" style="position:static">
      <input type="search" id="g-q" placeholder="搜尋大學／城市／專業關鍵字（如：臨床、會計、海濱）…">
      <select id="g-region"><option value="">全部地區</option>${regions.map(r => `<option ${st.region === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <select id="g-scheme">
        <option value="">全部途徑</option>
        <option value="保送" ${st.scheme === "保送" ? "selected" : ""}>內地保送</option>
        <option value="兩校聯招" ${st.scheme === "兩校聯招" ? "selected" : ""}>兩校聯招</option>
        <option value="四校聯考" ${st.scheme === "四校聯考" ? "selected" : ""}>四校聯考</option>
        <option value="本地院校" ${st.scheme === "本地院校" ? "selected" : ""}>本地院校</option>
      </select>
      <select id="g-sort">
        <option value="rank" ${st.sort === "rank" ? "selected" : ""}>按軟科排名</option>
        <option value="quota" ${st.sort === "quota" ? "selected" : ""}>按 2027 名額</option>
        <option value="hk" ${st.sort === "hk" ? "selected" : ""}>按濠江人數</option>
        <option value="name" ${st.sort === "name" ? "selected" : ""}>按名稱</option>
      </select>
      <div class="result-count" id="g-cnt"></div>
    </div>
    <div id="g-list"></div>
    <p style="color:var(--muted);font-size:.82rem">點卡片展開詳情；專業清單可展開收起。</p>`;

    const render = () => {
      const q = st.q.trim().toLowerCase();
      let list = unis.filter(u => {
        const hay = [u.name, u.nameS, u.region, u.intro, u.d.position, u.d.campus, u.d.environment, u.d.highlights, u.d.overall, (u.majors2027 || []).join(" ")].join(" ").toLowerCase();
        if (st.q && !hay.includes(q)) return false;
        if (st.region && u.region !== st.region) return false;
        if (st.scheme && u.scheme !== st.scheme) return false;
        return true;
      });
      if (st.sort === "rank") list.sort((a, b) => rkNum(a) - rkNum(b) || (b.quota2027 || 0) - (a.quota2027 || 0));
      if (st.sort === "quota") list.sort((a, b) => (b.quota2027 || 0) - (a.quota2027 || 0) || rkNum(a) - rkNum(b));
      if (st.sort === "hk") list.sort((a, b) => (b.houkong2025 ?? -1) - (a.houkong2025 ?? -1) || rkNum(a) - rkNum(b));
      if (st.sort === "name") list.sort((a, b) => a.nameS.localeCompare(b.nameS, "zh"));
      document.getElementById("g-cnt").textContent = `共 ${list.length} 所`;
      document.getElementById("g-list").innerHTML = list.map(u => {
        const d = u.d;
        const rk = u.rank2026 || u.rank2025;
        const rkHtml = rk
          ? (rk.board === "主榜" ? `軟科 2026 主榜第 ${rk.rank} 名` : `軟科 2026 ${esc(rk.board)}第 ${rk.rank} 名`)
          : (u.rankWorld2025 ? `🌍 軟科世界學術 2025 ${esc(u.rankWorld2025)}` : "未設榜");
        const quota = u.scheme === "保送" ? ((u.quota2027 ?? "—") + " 人") : u.scheme;
        const hk = u.houkong2025 != null ? u.houkong2025 + " 人" : "暫無資料";
        const majors = (u.majors2027 || []).length ? `
          <div class="g-sec"><h4>📋 2027 保送專業（${u.majors2027.length} 個，官方公佈）</h4>
          <ul class="majors-list collapsed" id="gm-${esc(u.id)}">${u.majors2027.map(m => `<li>${esc(m)}</li>`).join("")}</ul>
          <span class="toggler" data-id="${esc(u.id)}">展開全部 ▾</span></div>` : "";
        return `
        <div class="g-card" data-uni="${esc(u.id)}">
          <div class="g-head">
            <b>${esc(u.name)}</b><span class="g-region">${esc(u.region)}</span>
            <span class="badge blue">${esc(u.scheme)}</span>
            ${(u.tags || []).map(t => `<span class="badge">${esc(t)}</span>`).join("")}
            <span class="rk">${rkHtml}</span>
            <span class="badge gold">名額 ${quota}</span>
            <span class="badge gold">濠江 2025 ${hk}</span>
          </div>
          <div class="g-body">
            ${sec("🎓 學校定位", d.position || u.intro)}
            ${sec("📍 校區", d.campus)}
            ${sec("🌏 地理環境", d.environment)}
            ${sec("⭐ 專業亮點", d.highlights)}
            ${majors}
            ${sec("💬 綜合評價", d.overall)}
            ${u.extra ? sec("📌 另定要求", u.extra) : ""}
            <div class="facts">考核方式：<b>${esc(u.exam || "見招生簡章")}</b> ｜ 濠江 2025 錄取：<b>${hk}</b></div>
            <div class="links" style="margin-top:8px">
              ${u.brief2027 ? `<a href="${esc(u.brief2027)}" target="_blank" rel="noopener">📄 2027 簡章（官方 PDF）</a>` : ""}
              ${u.brief2026 ? `<a href="${esc(u.brief2026)}" target="_blank" rel="noopener">2026 簡章</a>` : ""}
              ${u.website ? `<a href="${esc(u.website)}" target="_blank" rel="noopener">🔗 官網</a>` : ""}
            </div>
          </div>
        </div>`;
      }).join("") || `<div class="empty-tip">找不到符合的大學</div>`;

      app.querySelectorAll("#g-list .g-head").forEach(h =>
        h.addEventListener("click", () => h.parentElement.classList.toggle("open")));
      app.querySelectorAll(".toggler").forEach(t => t.addEventListener("click", (e) => {
        e.stopPropagation();
        const ul = document.getElementById("gm-" + t.dataset.id);
        if (!ul) return;
        ul.classList.toggle("collapsed");
        t.textContent = ul.classList.contains("collapsed") ? "展開全部 ▾" : "收起 ▴";
      }));
    };

    document.getElementById("g-q").addEventListener("input", e => { st.q = e.target.value; render(); });
    document.getElementById("g-region").addEventListener("change", e => { st.region = e.target.value; render(); });
    document.getElementById("g-scheme").addEventListener("change", e => { st.scheme = e.target.value; render(); });
    document.getElementById("g-sort").addEventListener("change", e => { st.sort = e.target.value; render(); });
    render();
  };
})();
