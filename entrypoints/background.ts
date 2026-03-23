// cursor.com 各地区 dashboard URL（兼容 /cn/ /us/ 等前缀）
const CURSOR_USAGE_URL = 'https://cursor.com/cn/dashboard/usage';
const CURSOR_SPENDING_URL = 'https://cursor.com/cn/dashboard/spending';

export default defineBackground(async () => {
  // 点击插件图标时打开侧边栏（而不是 popup）
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // TODO: Step 4 — 注册 alarms 定时爬取
  // chrome.alarms.create('scrape', { periodInMinutes: 10 });
  // chrome.alarms.onAlarm.addListener((alarm) => { ... });

  console.log('[cursor-stats] background ready', {
    usageUrl: CURSOR_USAGE_URL,
    spendingUrl: CURSOR_SPENDING_URL,
  });
});
