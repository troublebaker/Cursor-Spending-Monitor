# Cursor Spending Monitor

> Track your Cursor.com API usage & spending — fully local, no API key, no server.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-brightgreen?logo=googlechrome)](https://chromewebstore.google.com)
[![WXT](https://img.shields.io/badge/Built%20with-WXT-blueviolet)](https://wxt.dev)

English · [中文](README.zh-CN.md)

---

## ✨ Features

- 📊 **Usage Dashboard** — visualize daily API calls, token usage, and spending trends
- 💰 **On-Demand Cost Tracking** — see per-request costs (US$0.04, etc.) exactly as shown on cursor.com
- 🧾 **Detailed Record Table** — date, type, model, tokens, cache R/W, input/output, cost
- 📈 **Charts** — daily calls, daily cost, daily token usage (5 metrics per model), model distribution
- 👤 **Multi-Account Support** — strict data isolation per account; auto-switches when you log in to a different account
- 🔔 **Budget Alerts** *(coming)* — get notified when on-demand spending exceeds your threshold
- 📤 **CSV Export** — export all records with one click, Excel-compatible (UTF-8 BOM)
- 🌐 **i18n** — English / 中文, follows browser language by default
- 🌙 **Dark / Light Mode** — follows system preference or manual override
- 🔒 **100% Local** — no server, no API key, no data collection

---

## 🚀 Installation

### From Chrome Web Store *(coming soon)*

Search **"Cursor Spending Monitor"** or click the badge above.

### Load Unpacked (Developer)

```bash
# 1. Clone
git clone https://github.com/troublebaker/Cursor-Spending-Monitor.git
cd Cursor-Spending-Monitor

# 2. Install
pnpm install

# 3. Build
pnpm build

# 4. Load in Chrome
# chrome://extensions → Enable "Developer mode" → "Load unpacked" → select .output/chrome-mv3/
```

---

## 🛠 Development

```bash
pnpm dev          # Start dev server (hot reload)
pnpm build        # Production build → .output/chrome-mv3/
pnpm zip          # Package for Chrome Web Store → .output/*.zip
pnpm compile      # TypeScript type check (zero errors = good)
```

**Dev workflow (recommended):**

1. Add `webExt: { disabled: true }` in `wxt.config.ts` (already set)
2. Run `pnpm dev`
3. In Chrome: `chrome://extensions` → **Load unpacked** → `.output/chrome-mv3/`
4. Save any file → background auto-reloads within ~2s

> ⚠️ Do **not** use drag-and-drop install — it breaks hot reload (Chrome copies files away from `.output/`).

---

## 📁 Project Structure

```
wxt-dev-wxt/
├── entrypoints/
│   ├── background.ts        # Service Worker: alarms, data merge, notifications
│   ├── content.ts           # Injected into cursor.com/*/dashboard/*
│   └── sidepanel/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx          # Main React UI
├── components/
│   ├── SpendingCard.tsx      # Plan quota bars
│   ├── OnDemandPanel.tsx     # On-demand usage progress
│   ├── RecordTable.tsx       # Usage record table
│   ├── StatusBar.tsx         # Scrape controls
│   ├── InboxPanel.tsx        # Progress/error messages
│   ├── ShareMenu.tsx         # Share / GitHub link
│   ├── Tooltip.tsx           # Viewport-aware custom tooltip
│   ├── CollapseSection.tsx   # Collapsible section (remembers state)
│   └── charts/
│       ├── DailyCallsChart.tsx
│       ├── DailyCostChart.tsx
│       ├── DailyTokenChart.tsx
│       └── ModelChart.tsx
├── utils/
│   ├── parser.ts             # DOM scraping (last verified: 2026-03-25)
│   ├── merge.ts              # Incremental dedup + account-aware cutoff
│   ├── storage.ts            # WXT storage items
│   ├── types.ts              # Shared TypeScript interfaces
│   └── i18n/                 # en.ts / zh-CN.ts / index.ts
├── docs/
│   └── privacy-policy.html  # Privacy policy (Chrome Web Store)
├── public/icon/              # 16 / 32 / 48 / 96 / 128 px icons
└── wxt.config.ts
```

---

## 🔒 Privacy

**No data ever leaves your device.**

- All scraped data is stored in `chrome.storage.local` on your machine
- No network requests to any external server
- No analytics, no tracking, no telemetry

Read the full [Privacy Policy](https://troublebaker.github.io/Cursor-Spending-Monitor/docs/privacy-policy.html).

---

## 🧠 How It Works

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

**Scrape Modes:**

| Mode | Trigger | Behavior |
|---|---|---|
| Quick | "更新数据" button | Incremental from last known date |
| +Token | "更新数据+token" button | Quick + hover each row for token breakdown |
| Auto-Active | Every 1 min → exponential backoff → stops after 1h idle | Background alarm |

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
