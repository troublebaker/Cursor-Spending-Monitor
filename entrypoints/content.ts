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
const SCRAPE_TIMEOUT_MS = 30_000;

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

async function runScrape(page: 'usage' | 'spending'): Promise<void> {
  // 等待 SPA 内容渲染
  if (page === 'usage') {
    await waitForElement(USAGE_SELECTOR, 15_000);
  } else {
    await waitForElement('main', 8_000).catch(() => sleep(2_000));
  }

  // 通知 background 就绪，拿回采集参数
  let params: ScrapeParams | null = null;
  try {
    params = await chrome.runtime.sendMessage({ type: 'PAGE_READY', page }) as ScrapeParams | null;
  } catch {
    // background SW 未响应（极少情况），按全量兜底
  }

  if (params) {
    await doScrape(page, params.isIncremental, params.cutoffIso);
  } else {
    await doScrape(page, false, null);
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

    if (!isLoggedIn()) {
      chrome.runtime.sendMessage({ type: 'NOT_LOGGED_IN' });
      return;
    }

    // 30 秒全局超时：任何阶段卡死都会触发 SCRAPE_ERROR，background 重置状态
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('scrape timeout (30s)')), SCRAPE_TIMEOUT_MS),
    );

    try {
      await Promise.race([runScrape(page), timeout]);
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
