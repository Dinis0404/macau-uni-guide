# 澳門保送大學指南 🎓

> 為澳門高中生而做的「內地高校保送」一站式資訊網站。**零框架、純靜態、開源**，改資料不用寫程式。

把分散在各處的升學資料整合在同一頁：

| 你想在這裡看 | 這裡有 |
|---|---|
| 📋 DSEDJ 官方保送名單（128 所高校、名額、考核方式） | [高校列表](#-功能) — 可搜尋、按地區／標籤／排名篩選；[總表](#-功能) — 全欄位可排序 |
| 📖 招生簡章**站內直接看** | 任何大學按「📖 預覽簡章」——PDF 站內打開，支援**兩校雙欄對比**（透過 `/api/brief` 代理去掉強制下載標頭） |
| 📚 2027 保送專業列表 | 已公佈的高校直接顯示專業清單（DSEDJ 專業查詢系統自動抓取，每月更新） |
| 📊 軟科中國大學排名（2025／2026，主榜＋7 個分榜） | 排名頁，標示出有參加澳門保送的學校 |
| ⚖️ 多所大學並排對比 | 對比頁：搜尋加入（最多 4 所）→ 平滑雷達圖（聲望／名額／濠江人氣／考核友好）＋逐項數據表 |
| 🧑‍🎓 濠江中學 2025 聯校保送去向（210 人、70 所高校） | 每張卡片上的「2025 濠江保送」欄 |
| 📅 保送時間表與常見問題 | 保送流程頁 |

## 🌐 部署到 Vercel（2 分鐘）

網站是純靜態檔案，Vercel 零配置即可上線：

1. Fork 或 push 本 repo 到你的 GitHub
2. 開啟 [vercel.com/new](https://vercel.com/new)，匯入該 repo
3. 直接按 **Deploy**（不用填任何設定）

之後每次 `git push`，Vercel 會自動重新部署；GitHub Actions 每月自動更新資料並 commit，網站也會自動跟著更新——**整條流水線不用人手維護**。

## 🗂 目錄結構

```
├── index.html                  # 單頁應用（hash 路由）
├── api/
│   └── brief.js                # Vercel function：簡章 PDF 代理（attachment→inline 站內預覽）
├── assets/
│   ├── style.css
│   └── app.js                  # 渲染＋篩選＋路由（原生 JS，無框架）
├── data/
│   ├── universities.json       # ★ 主資料：DSEDJ＋排名＋保送人數＋簡介 合併
│   ├── rankings.json           # 軟科完整榜單（排名頁用）
│   ├── meta.json               # 資料版本資訊
│   ├── intros.json             # 人工撰寫的 128 校簡介＋官網＋標籤
│   ├── houkong-2025.json       # 濠江中學 2025 保送數據（可照格式加自己學校）
│   ├── aliases.json            # DSEDJ↔軟科 校名對映
│   └── raw/                    # 抓取的原始資料（DSEDJ 頁面解析、軟科 API）
├── scripts/
│   ├── fetch-dsedj.mjs         # 抓 DSEDJ 名單頁
│   ├── fetch-ruanke.mjs        # 抓軟科官方 API（主榜＋分榜）
│   ├── build.mjs               # 合併 → universities.json（繁簡轉換）
│   └── dev-server.mjs          # 本地預覽
├── docs/                       # 濠江中學保送名單原始圖片（來源證據）
└── .github/workflows/update-data.yml  # 每月自動更新資料
```

## 💻 本地運行

```bash
npm install        # 安裝 opencc-js（繁簡轉換用）
npm run dev        # 開啟 http://localhost:8080
```

重新抓取資料：

```bash
npm run fetch      # = 抓 DSEDJ + 抓軟科 + 合併
```

## ✏️ 想補充資料？不用寫程式！

所有資料都是 `data/` 下的 JSON：

- **補上自己學校的保送數據**：複製 `data/houkong-2025.json` 的格式，改成 `houkong-2025-學校名.json`，並在 `scripts/build.mjs` 加一行載入（或開 issue 讓維護者處理）
- **修正簡介／官網／標籤**：直接改 `data/intros.json`
- **更新保送人數**：改 `data/houkong-2025.json` 的 `perUniversity`

在 GitHub 網頁上點開檔案 → 鉛筆圖示 → 修改 → Pull Request 就可以了。

## 📚 資料來源

- [DSEDJ 保送生推薦系統](https://appl2.dsedj.gov.mo/ChinaUEnrollment/index.jsp)（教育及青年發展局）— 名單、名額、考核要求、招生簡章、時間表
- [軟科中國大學排名](https://www.shanghairanking.cn/rankings/bcur)（上海軟科）— 官方 API，主榜＋合作辦學／醫藥／財經／語言／民族／政法／體育／中醫藥分榜
- [濠江中學官網](https://houkong.edu.mo/hkhs/event/752) — 2025 屆內地聯校保送名單（原始圖片存於 `docs/`，共 210 人）

## ⚠️ 免責聲明

本站為**非官方**整理，僅供升學參考，一切以 DSEDJ 及各大學官方最新公佈為準。招生簡章一律連結官方檔案；本站不發佈任何須登入官方系統才能查閱的資料。

## 📄 授權

- 代碼：[MIT](LICENSE)
- 資料（`data/`、`docs/`）：[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.zh_TW) — 引用時請註明來源並以相同方式共享
