import {
  waitForElement,
  scrapeAllPages,
  scrapeIncremental,
  parseSpending,
  isLoggedIn,
  sleep,
} from '../utils/parser';
import type { ScrapeParams } from '../utils/types';

const USAGE_SELECTOR = '.dashboard-table-rows';

function detectPage(): 'usage' | 'spending' | null {
  const path = location.pathname;
  if (path.includes('/dashboard/usage')) return 'usage';
  if (path.includes('/dashboard/spending')) return 'spending';
  return null;
}

async function doScrape(
  page: 'usage' | 'spending',
  isIncremental: boolean,
  cutoffIso: string | null,
): Promise<void> {
  if (page === 'usage') {
    const records = isIncremental && cutoffIso
      ? await scrapeIncremental(new Date(cutoffIso))
      : await scrapeAllPages();
    chrome.runtime.sendMessage({ type: 'USAGE_DATA', records, isIncremental });
    console.log(`[cursor-stats] usage scraped: ${records.length} records (incr=${isIncremental})`);
  } else {
    const spending = parseSpending();
    chrome.runtime.sendMessage({ type: 'SPENDING_DATA', spending });
    console.log('[cursor-stats] spending scraped');
  }
}

export default defineContentScript({
  matches: [
    'https://cursor.com/*/dashboard/usage*',
    'https://cursor.com/*/dashboard/spending*',
    'https://www.cursor.com/*/dashboard/usage*',
    'https://www.cursor.com/*/dashboard/spending*',
  ],

  async main() {
    const page = detectPage();
    if (!page) return;

    console.log(`[cursor-stats] injected on ${page} page`);

    // 未登录检测（cursor.com 会重定向，但在 SPA 内切换时可能出现未认证状态）
    if (!isLoggedIn()) {
      chrome.runtime.sendMessage({ type: 'NOT_LOGGED_IN' });
      return;
    }

    try {
      // 等待 SPA 内容渲染
      if (page === 'usage') {
        await waitForElement(USAGE_SELECTOR, 15_000);
      } else {
        // spending 页面没有固定容器，等待 main 或降级 sleep
        await waitForElement('main', 8_000).catch(() => sleep(2_000));
      }

      // 通知 background 就绪，拿回采集参数
      // background 通过 sendResponse 同步回复 ScrapeParams
      let params: ScrapeParams | null = null;
      try {
        params = await chrome.runtime.sendMessage({ type: 'PAGE_READY', page }) as ScrapeParams | null;
      } catch {
        // background SW 未响应（极少情况），按全量兜底
      }

      if (params) {
        await doScrape(page, params.isIncremental, params.cutoffIso);
      } else {
        // 用户手动打开 dashboard，或 background 无响应 → 全量采集
        await doScrape(page, false, null);
      }
    } catch (e) {
      console.error('[cursor-stats] scrape error', e);
      chrome.runtime.sendMessage({
        type: 'SCRAPE_ERROR',
        error: e instanceof Error ? e.message : String(e),
        page,
      });
    }
  },
});
