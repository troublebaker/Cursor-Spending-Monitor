import { runMigrations } from '../utils/migrations';
import { mergeRecords, getLatestDt, saveSpending, onScrapeComplete, nextIntervalMin } from '../utils/merge';
import {
  dashboardTabIdStorage,
  scrapeStateStorage,
  scrapeModeStorage,
  noTabReminderStorage,
} from '../utils/storage';
import type { ExtMessage, ScrapeParams } from '../utils/types';

// ─── URL 工具 ─────────────────────────────────────────────────────────────────

const DEFAULT_USAGE_URL = 'https://cursor.com/cn/dashboard/usage';

function isUsageUrl(url: string): boolean {
  return url.includes('/dashboard/usage');
}

function isAuthRedirect(url: string): boolean {
  return (
    url.includes('authenticator.cursor.sh') ||
    url.includes('/login') ||
    url.includes('/auth')
  );
}

/** /dashboard/usage → /dashboard/spending（保留地区前缀如 /cn/） */
function toSpendingUrl(url: string): string {
  return url.replace('/dashboard/usage', '/dashboard/spending');
}

// ─── Service worker 内的周期状态（非持久，SW 重启后归零无副作用） ──────────────

let cycleUsageAdded = 0;

// ─── Tab 管理 ──────────────────────────────────────────────────────────────────

async function ensureDashboardTab(): Promise<number> {
  const savedId = await dashboardTabIdStorage.getValue();

  if (savedId !== null) {
    try {
      const tab = await chrome.tabs.get(savedId);
      if (tab && !tab.discarded) return savedId;
    } catch {
      // tab 已被关闭
    }
  }

  const tab = await chrome.tabs.create({ url: DEFAULT_USAGE_URL, active: false });
  const newId = tab.id!;
  await dashboardTabIdStorage.setValue(newId);
  return newId;
}

// ─── 采集周期 ──────────────────────────────────────────────────────────────────

async function startScrapeCycle(): Promise<void> {
  const mode = await scrapeModeStorage.getValue();
  if (mode === 'manual') return;

  const state = await scrapeStateStorage.getValue();
  if (state.isRunning) return;

  await scrapeStateStorage.setValue({ ...state, isRunning: true, lastError: null });
  cycleUsageAdded = 0;

  const tabId = await ensureDashboardTab();
  const tab = await chrome.tabs.get(tabId).catch(() => null);

  if (tab?.url && isUsageUrl(tab.url)) {
    await chrome.tabs.reload(tabId);
  } else {
    await chrome.tabs.update(tabId, { url: DEFAULT_USAGE_URL });
  }
}

async function finishCycle(usageAdded: number): Promise<void> {
  await onScrapeComplete(usageAdded);
  await scheduleNextAlarm();
  broadcastToContexts({
    type: 'SCRAPE_STATUS',
    isRunning: false,
    lastScrapeAt: new Date().toISOString(),
  });
}

// ─── Alarm 调度 ────────────────────────────────────────────────────────────────

async function scheduleNextAlarm(): Promise<void> {
  const mode = await scrapeModeStorage.getValue();
  await chrome.alarms.clear('scrape');
  if (mode === 'manual') return;

  const state = await scrapeStateStorage.getValue();
  const intervalMin = nextIntervalMin(state.noDataCount, 1);
  await chrome.alarms.create('scrape', { delayInMinutes: intervalMin });
  console.log(`[cursor-stats] next scrape in ${intervalMin} min`);
}

// ─── 广播给所有侧边栏上下文 ────────────────────────────────────────────────────

function broadcastToContexts(msg: object): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    // 侧边栏未打开时正常失败，忽略
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default defineBackground(async () => {
  // 所有监听器必须同步注册，在 await 之前完成
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

  // ── 消息处理（content script / sidepanel → background） ──────────────────────
  chrome.runtime.onMessage.addListener((msg: ExtMessage, _sender, sendResponse) => {

    // content script 就绪，background 回复采集参数
    if (msg.type === 'PAGE_READY') {
      (async () => {
        const latestDt = await getLatestDt();
        const params: ScrapeParams = {
          isIncremental: latestDt !== null,
          cutoffIso: latestDt ? latestDt.toISOString() : null,
        };
        sendResponse(params);
      })();
      return true; // 保持 sendResponse 通道
    }

    // usage 数据到达 → 合并 → 导航到 spending 页
    if (msg.type === 'USAGE_DATA') {
      (async () => {
        const added = await mergeRecords(msg.records);
        cycleUsageAdded = added;

        const tabId = await dashboardTabIdStorage.getValue();
        if (tabId !== null) {
          const tab = await chrome.tabs.get(tabId).catch(() => null);
          if (tab?.url) {
            await chrome.tabs.update(tabId, { url: toSpendingUrl(tab.url) });
          }
        }
        sendResponse({ ok: true, added });
      })();
      return true;
    }

    // spending 数据到达 → 保存 → 结束周期 → 调度下次 alarm
    if (msg.type === 'SPENDING_DATA') {
      (async () => {
        await saveSpending(msg.spending);
        await finishCycle(cycleUsageAdded);
        sendResponse({ ok: true });
      })();
      return true;
    }

    // 采集报错 → 重置状态 → 重新调度
    if (msg.type === 'SCRAPE_ERROR') {
      (async () => {
        const state = await scrapeStateStorage.getValue();
        await scrapeStateStorage.setValue({ ...state, isRunning: false, lastError: msg.error });
        await scheduleNextAlarm();
        sendResponse({ ok: true });
      })();
      return true;
    }

    // 未登录 → 告知侧边栏，暂停调度
    if (msg.type === 'NOT_LOGGED_IN') {
      (async () => {
        const state = await scrapeStateStorage.getValue();
        await scrapeStateStorage.setValue({ ...state, isRunning: false });
        broadcastToContexts({ type: 'LOGIN_REQUIRED' });
      })();
      return false;
    }

    // sidepanel 触发立即采集（欢迎页「开始采集」、手动刷新、重新打开 tab）
    if (msg.type === 'TRIGGER_SCRAPE') {
      (async () => {
        // 即使当前是 manual 模式也允许触发一次
        const state = await scrapeStateStorage.getValue();
        if (state.isRunning) { sendResponse({ ok: false, reason: 'already running' }); return; }

        await scrapeStateStorage.setValue({ ...state, isRunning: true, lastError: null });
        cycleUsageAdded = 0;

        const tabId = await ensureDashboardTab();
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (tab?.url && isUsageUrl(tab.url)) {
          await chrome.tabs.reload(tabId);
        } else {
          await chrome.tabs.update(tabId, { url: DEFAULT_USAGE_URL });
        }
        // 同时重新调度 alarm（处理从 manual 切换到 auto 的情况）
        await scheduleNextAlarm();
        sendResponse({ ok: true });
      })();
      return true;
    }

    return false;
  });

  // ── Tab 关闭检测 ──────────────────────────────────────────────────────────────
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const savedId = await dashboardTabIdStorage.getValue();
    if (tabId !== savedId) return;

    await dashboardTabIdStorage.setValue(null);

    const noReminder = await noTabReminderStorage.getValue();
    if (!noReminder) {
      broadcastToContexts({ type: 'TAB_CLOSED' });
    }

    const state = await scrapeStateStorage.getValue();
    if (state.isRunning) {
      await scrapeStateStorage.setValue({ ...state, isRunning: false });
      await scheduleNextAlarm();
    }
  });

  // ── 登录重定向检测 ────────────────────────────────────────────────────────────
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const savedId = await dashboardTabIdStorage.getValue();
    if (tabId !== savedId || changeInfo.status !== 'complete' || !tab.url) return;

    if (isAuthRedirect(tab.url)) {
      const state = await scrapeStateStorage.getValue();
      await scrapeStateStorage.setValue({ ...state, isRunning: false });
      broadcastToContexts({ type: 'LOGIN_REQUIRED' });
    }
  });

  // ── Alarm ─────────────────────────────────────────────────────────────────────
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'scrape') {
      await startScrapeCycle();
    }
  });

  // ── 初始化（异步，在监听器注册完成后执行） ────────────────────────────────────
  await runMigrations();

  // 验证保存的 tab 是否依然存活
  const savedTabId = await dashboardTabIdStorage.getValue();
  if (savedTabId !== null) {
    try {
      await chrome.tabs.get(savedTabId);
    } catch {
      await dashboardTabIdStorage.setValue(null);
    }
  }

  await scheduleNextAlarm();

  // 模式切换时自动重新调度（sidepanel 写 storage，background 监听响应）
  scrapeModeStorage.watch(async (newMode) => {
    if (newMode === 'auto') {
      await scheduleNextAlarm();
    } else {
      await chrome.alarms.clear('scrape');
    }
  });

  console.log('[cursor-stats] background ready');
});
