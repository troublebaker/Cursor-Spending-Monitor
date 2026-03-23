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
/** 当前周期开始时间（ms），用于检测卡死超时 */
let cycleStartedAt = 0;
const CYCLE_TIMEOUT_MS = 30_000;

/** 若上一个周期已超时（>30s 未完成），强制重置 isRunning */
async function checkAndResetStaleCycle(): Promise<void> {
  const state = await scrapeStateStorage.getValue();
  if (state.isRunning && cycleStartedAt > 0 && Date.now() - cycleStartedAt > CYCLE_TIMEOUT_MS) {
    console.log('[cursor-stats] stale cycle detected (>30s), force resetting');
    await scrapeStateStorage.setValue({
      ...state,
      isRunning: false,
      lastError: 'scrape timeout (30s)',
    });
    cycleStartedAt = 0;
    cycleUsageAdded = 0;
    await scheduleNextAlarm();
    broadcastToContexts({ type: 'SCRAPE_STATUS', isRunning: false });
  }
}

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

  // 检测上一个周期是否已超时卡死
  await checkAndResetStaleCycle();

  const state = await scrapeStateStorage.getValue();
  if (state.isRunning) return;

  await scrapeStateStorage.setValue({ ...state, isRunning: true, lastError: null });
  cycleUsageAdded = 0;
  cycleStartedAt = Date.now();

  const tabId = await ensureDashboardTab();
  const tab = await chrome.tabs.get(tabId).catch(() => null);

  if (tab?.url && isUsageUrl(tab.url)) {
    await chrome.tabs.reload(tabId);
  } else {
    await chrome.tabs.update(tabId, { url: DEFAULT_USAGE_URL });
  }
}

async function finishCycle(usageAdded: number): Promise<void> {
  cycleStartedAt = 0; // 周期正常完成，清除超时守卫
  await onScrapeComplete(usageAdded);
  // 清除登录等待状态
  const state = await scrapeStateStorage.getValue();
  await scrapeStateStorage.setValue({ ...state, loginRequired: false });
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

/**
 * 未登录时每 1 分钟重试一次，复用 scrape alarm。
 * 当 alarm 触发时，startScrapeCycle 会导航后台 tab → content script 重新判断登录状态。
 * Chrome alarms 最小延迟为 1 分钟（MV3 规范限制）。
 */
async function scheduleLoginRetry(): Promise<void> {
  await chrome.alarms.clear('scrape');
  await chrome.alarms.create('scrape', { delayInMinutes: 1 });
  console.log('[cursor-stats] not logged in, will retry in 1 min');
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
  chrome.runtime.onMessage.addListener((msg: ExtMessage, sender, sendResponse) => {

    // content script 就绪，background 回复采集参数
    // ★ 关键：runtime.onMessage 是可靠的 SW 唤醒事件（不同于 tabs.onUpdated）
    //   在此同时处理：登录恢复检测 + tab 采纳 + loginRequired 清除
    if (msg.type === 'PAGE_READY') {
      (async () => {
        const senderTabId = sender.tab?.id ?? null;
        const state       = await scrapeStateStorage.getValue();
        const savedId     = await dashboardTabIdStorage.getValue();

        // 若处于登录等待态，采纳当前 tab 为 background tab，立刻恢复
        if (state.loginRequired && senderTabId !== null) {
          if (senderTabId !== savedId) {
            await dashboardTabIdStorage.setValue(senderTabId);
            console.log(`[cursor-stats] PAGE_READY: adopted tab ${senderTabId} (login restored)`);
          }
          await scrapeStateStorage.setValue({
            ...state, loginRequired: false, isRunning: true, lastError: null,
          });
          cycleUsageAdded = 0;
          cycleStartedAt = Date.now();
          await chrome.alarms.clear('scrape'); // 取消待触发的登录重试
          broadcastToContexts({ type: 'LOGIN_RESTORED' });
          console.log('[cursor-stats] login restored via PAGE_READY');
        } else if (!state.isRunning && senderTabId !== null) {
          // 非登录等待，但没有 isRunning（用户手动打开 dashboard），也标记运行态
          await scrapeStateStorage.setValue({ ...state, isRunning: true, lastError: null });
          cycleUsageAdded = 0;
          cycleStartedAt = Date.now();
          if (senderTabId !== savedId) {
            await dashboardTabIdStorage.setValue(senderTabId);
          }
        }

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
        cycleStartedAt = 0;
        const state = await scrapeStateStorage.getValue();
        await scrapeStateStorage.setValue({ ...state, isRunning: false, lastError: msg.error });
        await scheduleNextAlarm();
        sendResponse({ ok: true });
      })();
      return true;
    }

    // 未登录 → 持久化状态 + 告知侧边栏 + 1 分钟后自动重试
    if (msg.type === 'NOT_LOGGED_IN') {
      (async () => {
        const state = await scrapeStateStorage.getValue();
        await scrapeStateStorage.setValue({ ...state, isRunning: false, loginRequired: true });
        broadcastToContexts({ type: 'LOGIN_REQUIRED' });
        // 每 1 分钟重新导航后台 tab，content script 检测到登录后自动继续采集
        await scheduleLoginRetry();
      })();
      return false;
    }

    // sidepanel 触发立即采集（欢迎页「开始采集」、手动刷新、重新打开 tab）
    if (msg.type === 'TRIGGER_SCRAPE') {
      (async () => {
        await checkAndResetStaleCycle();
        // 即使当前是 manual 模式也允许触发一次
        const state = await scrapeStateStorage.getValue();
        if (state.isRunning) { sendResponse({ ok: false, reason: 'already running' }); return; }

        await scrapeStateStorage.setValue({ ...state, isRunning: true, lastError: null });
        cycleUsageAdded = 0;
        cycleStartedAt = Date.now();

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

    // 用户点击「去登录」：聚焦后台 tab 并导航到 usage URL（登录后 content script 自动触发）
    if (msg.type === 'OPEN_DASHBOARD_TAB') {
      (async () => {
        const tabId = await ensureDashboardTab();
        // 导航到 usage URL（未登录时 cursor.com 自动跳 auth，登录后跳回来 content script 触发）
        await chrome.tabs.update(tabId, { url: DEFAULT_USAGE_URL, active: true });
        // 同时将该 tab 所在的窗口聚焦
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (tab?.windowId) {
          await chrome.windows.update(tab.windowId, { focused: true });
        }
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

  // ── Tab 监听：监听所有 cursor.com tab，任意 dashboard tab 都可唤醒采集 ────────
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    // 不是 cursor.com / cursor.sh 相关页面，跳过
    if (!tab.url.includes('cursor.com') && !tab.url.includes('cursor.sh')) return;

    const savedId = await dashboardTabIdStorage.getValue();
    const state   = await scrapeStateStorage.getValue();

    // ① 任意 tab 落在登录/Auth 页
    if (isAuthRedirect(tab.url)) {
      // 只有 background tab 跳到登录页才视为"未登录"
      if (tabId === savedId) {
        await scrapeStateStorage.setValue({ ...state, isRunning: false, loginRequired: true });
        broadcastToContexts({ type: 'LOGIN_REQUIRED' });
        await scheduleLoginRetry();
      }
      return;
    }

    // ② 任意 tab 落在 /dashboard/（用户手动打开、重试成功、或从 auth 跳回）
    if (tab.url.includes('/dashboard/')) {
      // 采纳这个 tab 为新的 background tab（不切换焦点，保持后台静默）
      if (tabId !== savedId) {
        await dashboardTabIdStorage.setValue(tabId);
        console.log(`[cursor-stats] adopted tab ${tabId} as dashboard tab`);
      }
      // 若正在等待登录 OR 当前没有采集在跑，立刻开始一轮
      if (state.loginRequired || !state.isRunning) {
        await scrapeStateStorage.setValue({ ...state, loginRequired: false });
        broadcastToContexts({ type: 'LOGIN_RESTORED' });
        await startScrapeCycle();
      }
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
