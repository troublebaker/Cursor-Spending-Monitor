# Cursor Spending Monitor

> 追踪你的 Cursor.com API 用量与消费——完全本地运行，无需 API Key，无需服务器。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-brightgreen?logo=googlechrome)](https://chromewebstore.google.com)
[![WXT](https://img.shields.io/badge/Built%20with-WXT-blueviolet)](https://wxt.dev)

[English](README.md) · 中文

---

## ✨ 功能特性

- 📊 **用量仪表盘** — 可视化每日 API 调用次数、Token 用量与消费趋势
- 💰 **按需费用追踪** — 与 cursor.com 后台完全一致的原始费用格式（如 US$0.04）
- 🧾 **明细记录表** — 日期、类型、模型、Tokens、缓存读写、输入输出 Token、费用，一览无余
- 📈 **多维图表** — 每日调用量、每日费用、每日 Token（5 项指标可按模型切换）、模型分布
- 👤 **多账号支持** — 数据严格按账号隔离；检测到账号切换时自动适配，无需手动操作
- 🔔 **消费告警** *(即将推出)* — 按需消费超过阈值时推送通知
- 📤 **CSV 导出** — 一键导出全部记录，UTF-8 BOM 兼容 Excel
- 🌐 **中英双语** — 随浏览器语言自动切换，也可手动选择
- 🌙 **深色 / 浅色主题** — 跟随系统，或手动切换
- 🔒 **100% 本地** — 无服务器、无 API Key、零数据上传

---

## 🚀 安装方式

### Chrome 网上应用店 *(即将上线)*

搜索 **"Cursor Spending Monitor"** 或点击上方徽章。

### 开发者加载（手动安装）

```bash
# 1. 克隆仓库
git clone https://github.com/troublebaker/Cursor-Spending-Monitor.git
cd Cursor-Spending-Monitor

# 2. 安装依赖
pnpm install

# 3. 构建
pnpm build

# 4. 在 Chrome 加载
# chrome://extensions → 打开"开发者模式" → "加载已解压的扩展程序" → 选择 .output/chrome-mv3/
```

---

## 🛠 开发指南

```bash
pnpm dev          # 启动开发服务器（支持热重载）
pnpm build        # 生产构建 → .output/chrome-mv3/
pnpm zip          # 打包供 Chrome 网上应用店上传 → .output/*.zip
pnpm compile      # TypeScript 类型检查（零错误 = 通过）
```

**推荐开发流程：**

1. `wxt.config.ts` 中保留 `webExt: { disabled: true }`（已配置）
2. 运行 `pnpm dev`
3. Chrome 中：`chrome://extensions` → **加载已解压的扩展程序** → `.output/chrome-mv3/`
4. 保存任意文件 → background ~2 秒内自动重载

> ⚠️ **不要**用拖拽方式安装 — 这会断开 Chrome 与 `.output/` 目录的连接，导致热重载失效。

---

## 📁 项目结构

```
wxt-dev-wxt/
├── entrypoints/
│   ├── background.ts        # Service Worker：定时任务、数据合并、通知
│   ├── content.ts           # 注入 cursor.com/*/dashboard/* 页面
│   └── sidepanel/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx          # 主 React UI
├── components/
│   ├── SpendingCard.tsx      # 套餐配额进度条
│   ├── OnDemandPanel.tsx     # 按需用量面板
│   ├── RecordTable.tsx       # 用量明细表格
│   ├── StatusBar.tsx         # 采集控制栏
│   ├── InboxPanel.tsx        # 进度/错误消息收件箱
│   ├── ShareMenu.tsx         # 分享 / GitHub 链接
│   ├── Tooltip.tsx           # 视口感知自定义 Tooltip
│   ├── CollapseSection.tsx   # 可折叠区块（记忆状态）
│   └── charts/
│       ├── DailyCallsChart.tsx
│       ├── DailyCostChart.tsx
│       ├── DailyTokenChart.tsx
│       └── ModelChart.tsx
├── utils/
│   ├── parser.ts             # DOM 解析（最后验证：2026-03-25）
│   ├── merge.ts              # 增量去重 + 账号感知截止时间
│   ├── storage.ts            # WXT storage 定义
│   ├── types.ts              # 共享 TypeScript 类型
│   └── i18n/                 # en.ts / zh-CN.ts / index.ts
├── docs/
│   └── privacy-policy.html  # 隐私政策（Chrome 网上应用店用）
├── public/icon/              # 16 / 32 / 48 / 96 / 128 px 图标
└── wxt.config.ts
```

---

## 🔒 隐私说明

**你的数据永远不会离开你的设备。**

- 所有采集数据均存储在本机的 `chrome.storage.local` 中
- 不向任何外部服务器发送网络请求
- 无分析统计、无追踪、无遥测

查看完整 [隐私政策](https://troublebaker.github.io/Cursor-Spending-Monitor/docs/privacy-policy.html)。

---

## 🧠 工作原理

```
用户访问 cursor.com/*/dashboard/usage
  → content script 等待表格渲染完成
  → 采集用量记录（全部分页）+ 消费卡片
  → sendMessage({ type: 'USAGE_DATA', records })
  → background 增量合并写入 chrome.storage.local（按账号隔离）
  → background 将标签页导航至 /dashboard/spending
  → content script 采集按需配额数据
  → 侧边栏读取 storage，渲染图表 + 明细表
```

**采集模式：**

| 模式 | 触发方式 | 行为 |
|---|---|---|
| 快速 | 点击「更新数据」 | 从上次已知日期增量采集 |
| +Token | 点击「更新数据+Token」 | 快速采集 + 悬停每行获取 Token 明细 |
| 自动活跃 | 每 1 分钟 → 指数衰减 → 1 小时无数据后停止 | 后台定时 alarm |

---

## 🤝 参与贡献

欢迎提交 PR 和 Issue！较大改动请先开 Issue 讨论。

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/my-feature`
3. 提交：`git commit -m "feat: 描述"`
4. 推送并创建 PR

---

## 📄 许可证

MIT © [CodeJames](https://github.com/troublebaker) · [@CodeJames333025](https://x.com/CodeJames333025)
