# Cursor Spending Monitor

> 可视化你的 Cursor.com API 用量与消费 — 完全本地运行，无需 API Key，无服务器。

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/ejhbbdfjonjoacmggekjjpilaeplbnek?logo=googlechrome&label=Chrome)](https://chromewebstore.google.com/detail/cursor-spending-monitor/ejhbbdfjonjoacmggekjjpilaeplbnek)
[![Edge Add-ons](https://img.shields.io/badge/Edge-Add--ons-0078D7?logo=microsoftedge)](https://microsoftedge.microsoft.com/addons/detail/cursor-spending-monitor/hcmkkgbdgaoahocjkbnhedlgcjhfnmeb)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](README.md) · 中文

---

## 🚀 安装（一键直达）

| 浏览器 | 链接 |
|---|---|
| **Google Chrome** | [从 Chrome 应用商店安装](https://chromewebstore.google.com/detail/cursor-spending-monitor/ejhbbdfjonjoacmggekjjpilaeplbnek) |
| **Microsoft Edge** | [从 Edge 加载项安装](https://microsoftedge.microsoft.com/addons/detail/cursor-spending-monitor/hcmkkgbdgaoahocjkbnhedlgcjhfnmeb) |

> 无需账号，无需 API Key。点击「添加至 Chrome / Edge」即可完成安装。

---

## 📖 使用教程

### 第一步：安装插件

点击上方对应浏览器的安装链接，在商店页面点击「添加至 Chrome」或「获取」。

### 第二步：打开侧边栏

安装完成后，点击浏览器工具栏中的插件图标，或通过 Chrome 的侧边栏入口打开。

### 第三步：登录 Cursor

确保你已经在同一浏览器中登录了 [cursor.com](https://cursor.com)。插件会自动检测登录状态。

### 第四步：采集数据

点击侧边栏中的 **「更新数据」** 按钮，插件会自动打开你的 Cursor 账单页面并读取数据，整个过程约 10-30 秒。

### 第五步：查看图表

数据采集完成后，图表和明细表格会自动更新。

---

### 采集模式说明

| 按钮 | 功能 |
|---|---|
| **更新数据** | 从上次已知日期增量抓取（速度快） |
| **更新数据+token** | 在增量抓取基础上，悬停每行获取完整 Token 明细（较慢但数据最全） |

### 使用技巧

- 插件只读取 `cursor.com/*/dashboard/` 页面，不访问任何其他网站
- 所有数据存储在本机的 `chrome.storage.local` 中，从不上传
- 切换 Cursor 账号后数据自动隔离，多账号互不干扰
- 点击 **「CSV 导出」** 可下载全部记录，在 Excel / Google Sheets 中进一步分析

---

## ✨ 功能特性

- 📊 **用量仪表盘** — 可视化每日 API 调用次数、Token 用量、消费趋势
- 💰 **按需费用追踪** — 精确显示每次请求费用，与 cursor.com 账单完全一致
- 🧾 **详细记录表格** — 日期、类型、模型、Token、缓存读写、输入输出、费用
- 📈 **多维图表** — 每日调用、每日费用、每日 Token（5 项指标 / 模型）、模型分布
- 👤 **多账号支持** — 按账号严格隔离数据，切换账号自动识别
- 📤 **CSV 导出** — 一键导出全部记录，Excel 兼容（UTF-8 BOM）
- 🌙 **深色 / 浅色模式** — 跟随系统或手动切换
- 🌐 **中英文界面** — 跟随浏览器语言自动切换
- 🔒 **100% 本地** — 无服务器、无 API Key、不收集任何数据

---

## 🔒 隐私说明

**你的数据永远不会离开本机。**

- 所有抓取数据存储在本机的 `chrome.storage.local` 中
- 不向任何外部服务器发送网络请求
- 无埋点、无追踪、无遥测

查看完整 [隐私政策](https://troublebaker.github.io/Cursor-Spending-Monitor/docs/privacy-policy.html)。

---

---

## 🛠 从源码构建 *(仅限开发者)*

> **普通用户请直接使用上方的一键安装链接，无需阅读此节。**

```bash
# 1. 克隆仓库
git clone https://github.com/troublebaker/Cursor-Spending-Monitor.git
cd Cursor-Spending-Monitor/cursor监控插件/wxt-dev-wxt

# 2. 安装依赖
pnpm install

# 3. 构建
pnpm build

# 4. 在 Chrome 中加载
# 打开 chrome://extensions → 开启「开发者模式」→ 点击「加载已解压的扩展程序」→ 选择 .output/chrome-mv3/
```

### 开发命令

```bash
pnpm dev          # 启动开发服务器（热重载）
pnpm build        # 生产构建 → .output/chrome-mv3/
pnpm zip          # 打包 zip（用于上传商店）
pnpm compile      # TypeScript 类型检查
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
