# Cursor Spending Monitor

> 可视化你的 Cursor.com API 用量与消费 — 完全本地运行，无需 API Key，无服务器。

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ejhbbdfjonjoacmggekjjpilaeplbnek?logo=googlechrome&label=Chrome)](https://chromewebstore.google.com/detail/cursor-spending-monitor/ejhbbdfjonjoacmggekjjpilaeplbnek)
[![Edge Add-ons](https://img.shields.io/badge/Edge-Add--ons-0078D7?logo=microsoftedge)](https://microsoftedge.microsoft.com/addons/detail/cursor-spending-monitor/gfdehkijfajcebgjhjkiablglkckjgoa)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) · 中文

---

## ✨ 功能特性

- 📊 **用量仪表盘** — 可视化每日 API 调用次数、Token 用量、消费趋势
- 💰 **按需费用追踪** — 精确显示每次请求费用（如 US$0.04），与 cursor.com 账单完全一致
- 🧾 **详细记录表格** — 日期、类型、模型、Token、缓存读写、输入输出、费用
- 📈 **多维图表** — 每日调用、每日费用、每日 Token（5 项指标 / 模型）、模型分布
- 👤 **多账号支持** — 按账号严格隔离数据，切换账号自动识别
- 📤 **CSV 导出** — 一键导出全部记录，Excel 兼容（UTF-8 BOM）
- 🌙 **深色 / 浅色模式** — 跟随系统或手动切换
- 🌐 **中英文界面** — 跟随浏览器语言自动切换
- 🔒 **100% 本地** — 无服务器、无 API Key、不收集任何数据

---

## 🚀 安装

### Chrome 应用商店（推荐）

在 Chrome 应用商店搜索 **"Cursor Spending Monitor"**，或点击上方徽章直接安装。

### Microsoft Edge 加载项

在 Edge 加载项商店搜索 **"Cursor Spending Monitor"**，或点击上方徽章直接安装。

### 手动加载（开发者）

```bash
# 1. 克隆仓库
git clone https://github.com/troublebaker/Cursor-Spending-Monitor.git
cd Cursor-Spending-Monitor

# 2. 安装依赖
pnpm install

# 3. 构建
pnpm build

# 4. 在 Chrome 中加载
# 打开 chrome://extensions → 开启"开发者模式" → 点击"加载已解压的扩展程序" → 选择 .output/chrome-mv3/
```

---

## 🔒 隐私说明

**你的数据永远不会离开本机。**

- 所有抓取数据存储在本机的 `chrome.storage.local` 中
- 不向任何外部服务器发送网络请求
- 无埋点、无追踪、无遥测

查看完整 [隐私政策](https://troublebaker.github.io/Cursor-Spending-Monitor/docs/privacy-policy.html)。

---

## 🧠 工作原理

```
用户访问 cursor.com/*/dashboard/usage
  → content script 等待表格渲染完成
  → 抓取用量记录（支持翻页）+ Spending 卡片
  → 发送消息 { type: 'USAGE_DATA', records }
  → background 增量合并写入 chrome.storage.local（按账号隔离）
  → background 导航至 /dashboard/spending
  → content script 抓取按需额度
  → 侧边栏读取 storage，渲染图表 + 记录表格
```

**采集模式：**

| 模式 | 触发方式 | 行为 |
|---|---|---|
| 快速 | 点击「更新数据」 | 从上次已知日期增量抓取 |
| +Token | 点击「更新数据+token」 | 快速模式 + 悬停每行获取 Token 详情 |
| 自动 | 每 1 分钟 → 指数退避 → 1 小时无新数据后停止 | 后台定时器 |

---

## 📁 项目结构

```
wxt-dev-wxt/
├── entrypoints/
│   ├── background.ts        # Service Worker：定时器、数据合并
│   ├── content.ts           # 注入 cursor.com/*/dashboard/*
│   └── sidepanel/           # React 侧边栏 UI
├── components/              # React 组件（图表、卡片、表格等）
├── utils/
│   ├── parser.ts            # DOM 解析（最后验证：2026-03-25）
│   ├── merge.ts             # 增量去重 + 账号感知截断
│   ├── storage.ts           # WXT storage 封装
│   └── i18n/                # 多语言（en / zh-CN）
├── docs/
│   └── privacy-policy.html # 隐私政策
└── wxt.config.ts
```

---

## 🤝 贡献

欢迎提交 PR 和 Issue！大改动请先开 Issue 讨论。

1. Fork 仓库
2. 创建功能分支：`git checkout -b feat/my-feature`
3. 提交：`git commit -m "feat: description"`
4. 推送并创建 PR

---

## 📄 许可证

MIT © [CodeJames](https://github.com/troublebaker) · [@CodeJames333025](https://x.com/CodeJames333025)
