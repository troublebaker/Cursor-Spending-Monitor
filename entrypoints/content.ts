export default defineContentScript({
  // 只注入 cursor.com dashboard 页，最小化权限影响范围
  matches: [
    'https://cursor.com/*/dashboard/usage*',
    'https://cursor.com/*/dashboard/spending*',
    'https://www.cursor.com/*/dashboard/usage*',
    'https://www.cursor.com/*/dashboard/spending*',
  ],
  async main() {
    // TODO: Step 4 — 等待 SPA 渲染后爬取数据
    // await waitForElement('.dashboard-table-rows');
    // const records = await scrapeAllPages();
    // chrome.runtime.sendMessage({ type: 'USAGE_DATA', records, isIncremental: false });
    console.log('[cursor-stats] content script injected', location.pathname);
  },
});
