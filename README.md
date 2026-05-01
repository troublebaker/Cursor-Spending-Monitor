# Cursor Spending Monitor

> Track your Cursor.com API usage & spending — fully local, no API key, no server.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ejhbbdfjonjoacmggekjjpilaeplbnek?logo=googlechrome&label=Chrome)](https://chromewebstore.google.com/detail/cursor-spending-monitor/ejhbbdfjonjoacmggekjjpilaeplbnek)
[![Edge Add-ons](https://img.shields.io/badge/Edge-Add--ons-0078D7?logo=microsoftedge)](https://microsoftedge.microsoft.com/addons/detail/cursor-spending-monitor/hcmkkgbdgaoahocjkbnhedlgcjhfnmeb)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WXT](https://img.shields.io/badge/Built%20with-WXT-blueviolet)](https://wxt.dev)

English · [中文](README.zh-CN.md)

---

## 🚀 Install (One Click)

| Browser | Link |
|---|---|
| **Google Chrome** | [Install from Chrome Web Store](https://chromewebstore.google.com/detail/cursor-spending-monitor/ejhbbdfjonjoacmggekjjpilaeplbnek) |
| **Microsoft Edge** | [Install from Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/cursor-spending-monitor/hcmkkgbdgaoahocjkbnhedlgcjhfnmeb) |

> No account needed. No API key. Click "Add to Chrome / Edge" and you're done.

---

## 📖 How to Use

1. **Install** the extension from the store link above.
2. **Log in** to [cursor.com](https://cursor.com) in the same browser (if not already).
3. **Open the sidebar** — click the extension icon in the toolbar, or open Chrome's side panel.
4. **Click "更新数据" (Update Data)** — the extension navigates your Cursor dashboard and scrapes usage records automatically.
5. **View your data** — charts and the detail table populate within seconds.

### Scrape Modes

| Button | What it does |
|---|---|
| **更新数据** | Incremental update from your last known date (fast) |
| **更新数据+token** | Same as above, plus hovers each row to capture full token breakdown |

### Tips

- The extension only reads `cursor.com/*/dashboard/` pages — it never touches any other site.
- Data is stored entirely in `chrome.storage.local` on your own machine.
- Switch Cursor accounts? Data is automatically isolated per account.
- Use **CSV Export** to download all records for further analysis in Excel/Sheets.

---

## ✨ Features

- 📊 **Usage Dashboard** — visualize daily API calls, token usage, and spending trends
- 💰 **Exact Cost Tracking** — per-request costs (US$0.04, etc.) exactly as shown on cursor.com
- 🧾 **Detailed Record Table** — date, type, model, tokens, cache R/W, input/output, cost
- 📈 **Charts** — daily calls, daily cost, daily token usage (5 metrics per model), model distribution
- 👤 **Multi-Account Support** — strict data isolation per account; auto-switches on login
- 📤 **CSV Export** — one-click export, Excel-compatible (UTF-8 BOM)
- 🌐 **i18n** — English / 中文, follows browser language by default
- 🌙 **Dark / Light Mode** — follows system preference or manual override
- 🔒 **100% Local** — no server, no API key, no data collection

---

## 🔒 Privacy

**No data ever leaves your device.**

- All scraped data is stored in `chrome.storage.local` on your machine
- No network requests to any external server
- No analytics, no tracking, no telemetry

Read the full [Privacy Policy](https://troublebaker.github.io/Cursor-Spending-Monitor/docs/privacy-policy.html).

---

---

## 🛠 Build from Source *(for developers only)*

> **Regular users do not need this section.** Use the one-click install links above.

```bash
# 1. Clone
git clone https://github.com/troublebaker/Cursor-Spending-Monitor.git
cd Cursor-Spending-Monitor/cursor监控插件/wxt-dev-wxt

# 2. Install dependencies
pnpm install

# 3. Build
pnpm build

# 4. Load in Chrome
# chrome://extensions → Enable "Developer mode" → "Load unpacked" → select .output/chrome-mv3/
```

### Dev Commands

```bash
pnpm dev          # Start dev server (hot reload)
pnpm build        # Production build → .output/chrome-mv3/
pnpm zip          # Package for Chrome Web Store → .output/*.zip
pnpm compile      # TypeScript type check
```

**Dev workflow (recommended):**

1. `webExt: { disabled: true }` is already set in `wxt.config.ts`
2. Run `pnpm dev`
3. In Chrome: `chrome://extensions` → **Load unpacked** → `.output/chrome-mv3/`
4. Save any file → background auto-reloads within ~2s

> ⚠️ Do **not** use drag-and-drop install — it breaks hot reload.

---

## 📁 Project Structure

```
wxt-dev-wxt/
├── entrypoints/
│   ├── background.ts        # Service Worker: alarms, data merge
│   ├── content.ts           # Injected into cursor.com/*/dashboard/*
│   └── sidepanel/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx          # Main React UI
├── components/
│   ├── SpendingCard.tsx
│   ├── OnDemandPanel.tsx
│   ├── RecordTable.tsx
│   ├── StatusBar.tsx
│   ├── InboxPanel.tsx
│   ├── ShareMenu.tsx
│   └── charts/
│       ├── DailyCallsChart.tsx
│       ├── DailyCostChart.tsx
│       ├── DailyTokenChart.tsx
│       └── ModelChart.tsx
├── utils/
│   ├── parser.ts             # DOM scraping (last verified: 2026-03-25)
│   ├── merge.ts              # Incremental dedup + account-aware cutoff
│   ├── storage.ts
│   ├── types.ts
│   └── i18n/                 # en.ts / zh-CN.ts / index.ts
├── docs/
│   └── privacy-policy.html
└── wxt.config.ts
```

---

## 🧠 How It Works (Technical)

```
User visits cursor.com/*/dashboard/usage
  → content script waits for table to render
  → scrapes usage records (all pages) + spending card
  → sendMessage({ type: 'USAGE_DATA', records })
  → background merges into chrome.storage.local (incremental, account-aware)
  → background navigates tab to /dashboard/spending
  → content script scrapes on-demand quota
  → sidepanel reads storage, renders charts + table
```

---

## 🤝 Contributing

PRs and issues welcome! Please open an issue before large changes.

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: description"`
4. Push and open a PR

---

## 📄 License

MIT © [CodeJames](https://github.com/troublebaker) · [@CodeJames333025](https://x.com/CodeJames333025)
