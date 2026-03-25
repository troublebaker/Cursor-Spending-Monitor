import { runMigrations } from '../utils/migrations';
import { mergeRecords, getLatestDt, saveSpending, onScrapeComplete, nextIntervalMin } from '../utils/merge';
import {
  dashboardTabIdStorage,
  scrapeStateStorage,
  scrapeModeStorage,
  noTabReminderStorage,
  inboxStorage,
  slowScrapeStateStorage,
  usageStorage,
  pendingSlowScrapeStorage,
  autoIncludeTokenStorage,
} from '../utils/storage';
import type { ExtMessage, ScrapeParams, InboxMessage, TokenBreakdown } from '../utils/types';

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
const CYCLE_TIMEOUT_MS = 20_000;

/** 若上一个周期已超时（>20s 未完成），强制重置 isRunning */
async function checkAndResetStaleCycle(): Promise<void> {
  const state = await scrapeStateStorage.getValue();
  if (state.isRunning && cycleStartedAt > 0 && Date.now() - cycleStartedAt > CYCLE_TIMEOUT_MS) {
    console.log('[cursor-stats] stale cycle detected (>20s), force resetting');
    await scrapeStateStorage.setValue({
      ...state,
      isRunning: false,
      lastError: 'scrape timeout (20s)',
    });
    cycleStartedAt = 0;
    cycleUsageAdded = 0;
    await scheduleNextAlarm();
    broadcastToContexts({ type: 'SCRAPE_FAILED', errorType: 'timeout', error: 'scrape timeout (20s)' });
  }
}

// ─── 慢速采集状态（SW 级别，非持久） ──────────────────────────────────────────

/** 慢速采集是否正在进行（SW 级别标志） */
let slowRunning = false;
/** 慢速采集目标 tab ID */
let slowTabId: number | null = null;
/**
 * 慢速采集 breakdown 累积器（SW 内存）。
 * 仅在全部页面完成后才写入 usageStorage，取消时直接清空抛弃。
 */
let slowBreakdownAccum: Record<string, TokenBreakdown> = {};

/** 生成简短 ID（用于 InboxMessage） */
function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 追加一条 InboxMessage 到 storage（最多 100 条）并广播 */
async function pushInboxMessage(message: InboxMessage): Promise<void> {
  const list = await inboxStorage.getValue();
  const next = [message, ...list].slice(0, 100);
  await inboxStorage.setValue(next);
  broadcastToContexts({ type: 'INBOX_MESSAGE', message });
}

/**
 * 将慢速采集收到的 breakdown 数据合并进 usageStorage。
 * key 格式：`${dateTitle}|${modelTitle}`，与 content.ts 的 extractRowKey 一致。
 */
async function mergeBreakdown(breakdown: Record<string, TokenBreakdown>): Promise<number> {
  if (Object.keys(breakdown).length === 0) return 0;
  const records = await usageStorage.getValue();
  let updated = 0;
  const next = records.map(r => {
    const key = `${r.dt}|${r.model}`;
    if (breakdown[key]) {
      updated++;
      return { ...r, tokenBreakdown: breakdown[key] };
    }
    return r;
  });
  if (updated > 0) await usageStorage.setValue(next);
  return updated;
}

// ─── 慢速采集启动辅助 ──────────────────────────────────────────────────────────

async function startSlowScrape(): Promise<void> {
  if (slowRunning) return;
  slowRunning = true;
  slowBreakdownAccum = {}; // 每次开始重置累积器
  const tabId = await ensureDashboardTab();
  slowTabId = tabId;
  await slowScrapeStateStorage.setValue({ isRunning: true, currentPage: 0, totalPages: 0, startedAt: new Date().toISOString() });
  await pushInboxMessage({
    id: makeId(), ts: new Date().toISOString(), kind: 'info',
    text: '开始 Token 详情采集，后台逐页读取中…',
  });
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.url && tab.url.includes('/dashboard/usage')) {
    await chrome.tabs.reload(tabId);
  } else {
    await chrome.tabs.update(tabId, { url: DEFAULT_USAGE_URL });
  }
}



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

  // 若用户使用「更新数据(含输入输出)」，普通采集完成后自动启动慢速 Token 采集
  const pending = await pendingSlowScrapeStorage.getValue();
  if (pending && !slowRunning) {
    await pendingSlowScrapeStorage.setValue(false);
    await startSlowScrape();
    return;
  }
  // 若用户开启「自动含 Token」选项，每次自动采集完也触发 Token 采集
  const autoToken = await autoIncludeTokenStorage.getValue();
  if (autoToken && !slowRunning) {
    await startSlowScrape();
  }
}

// ─── Alarm 调度 ────────────────────────────────────────────────────────────────

async function scheduleNextAlarm(): Promise<void> {
  const mode = await scrapeModeStorage.getValue();
  await chrome.alarms.clear('scrape');
  if (mode === 'manual') return;

  const state = await scrapeStateStorage.getValue();
  // auto_calm 基准 5 分钟，auto 基准 1 分钟
  const baseMin = mode === 'auto_calm' ? 5 : 1;
  const intervalMin = nextIntervalMin(state.noDataCount, baseMin);
  await chrome.alarms.create('scrape', { delayInMinutes: intervalMin });
  console.log(`[cursor-stats] next scrape in ${intervalMin} min (mode=${mode})`);
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

/**
 * 直接查询所有打开的 Tab，找第一个 spending 页面。
 * 用于 spending 测试消息路由，不依赖 dashboardTabIdStorage
 * （解决 isRunning=true 时 tabId 未更新的问题）。
 */
async function findSpendingTab(): Promise<number | null> {
  const patterns = [
    'https://cursor.com/*/dashboard/spending*',
    'https://cursor.com/dashboard/spending*',
    'https://www.cursor.com/*/dashboard/spending*',
    'https://www.cursor.com/dashboard/spending*',
  ];
  for (const url of patterns) {
    const tabs = await chrome.tabs.query({ url }).catch(() => [] as chrome.tabs.Tab[]);
    if (tabs.length > 0 && tabs[0].id !== undefined) return tabs[0].id;
  }
  return null;
}

/**
 * 查询所有打开的 usage 标签页（含 /cn/ 前缀变体）。
 * 优先返回 dashboardTabIdStorage 存储的 tab（如果它确实是 usage 页），
 * 其次 query 查找任意 usage tab，保证 content script 存在。
 */
async function findUsageTab(): Promise<number | null> {
  // 先尝试已知 tab
  const savedId = await dashboardTabIdStorage.getValue();
  if (savedId !== null) {
    const tab = await chrome.tabs.get(savedId).catch(() => null);
    if (tab?.url?.includes('/dashboard/usage') && !tab.discarded) return savedId;
  }
  // fallback: query 所有 usage 页
  const patterns = [
    'https://cursor.com/*/dashboard/usage*',
    'https://cursor.com/dashboard/usage*',
    'https://www.cursor.com/*/dashboard/usage*',
    'https://www.cursor.com/dashboard/usage*',
  ];
  for (const url of patterns) {
    const tabs = await chrome.tabs.query({ url }).catch(() => [] as chrome.tabs.Tab[]);
    if (tabs.length > 0 && tabs[0].id !== undefined) return tabs[0].id;
  }
  return null;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default defineBackground(async () => {
  // 所有监听器必须同步注册，在 await 之前完成
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

  // ── Dev 模式：SW 重启（热重载）时自动刷新 dashboard tab，重新注入 content script ──
  // 每次保存代码后 background 重启，旧 content script 上下文失效，需要 tab reload 才能重连
  if (import.meta.env.DEV) {
    (async () => {
      const savedId = await dashboardTabIdStorage.getValue();
      if (savedId !== null) {
        const tab = await chrome.tabs.get(savedId).catch(() => null);
        if (tab?.url && (tab.url.includes('/dashboard/') || tab.url.includes('cursor.com'))) {
          await chrome.tabs.reload(savedId).catch(() => {});
          console.log('[cursor-stats][dev] hot-reload: dashboard tab reloaded for content script reinject');
        }
      }
    })();
  }

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
          // 慢速采集 tab 的 PAGE_READY 不设置 normal isRunning（慢速采集由 slowScrapeStateStorage 独立跟踪）
          // 只有 normal 采集 tab 才设置 scrapeStateStorage.isRunning = true
          if (!(slowRunning && senderTabId === slowTabId)) {
            await scrapeStateStorage.setValue({ ...state, isRunning: true, lastError: null });
            cycleUsageAdded = 0;
            cycleStartedAt = Date.now();
          }
          if (senderTabId !== savedId) {
            await dashboardTabIdStorage.setValue(senderTabId);
          }
        }

        const latestDt = await getLatestDt();
        const isSlowTab = slowRunning && senderTabId === slowTabId;
        // 慢速增量：收集已有 tokenBreakdown 的行 key，content script 跳过这些行
        const existingTokenKeys = isSlowTab
          ? (await usageStorage.getValue())
              .filter(r => r.tokenBreakdown != null)
              .map(r => `${r.dt}|${r.model}`)
          : undefined;
        const params: ScrapeParams = {
          isIncremental: latestDt !== null,
          cutoffIso: latestDt ? latestDt.toISOString() : null,
          slowMode: isSlowTab,
          existingTokenKeys,
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

    // 采集报错 → 重置状态 → 广播到侧边栏 → 重新调度
    if (msg.type === 'SCRAPE_ERROR') {
      (async () => {
        cycleStartedAt = 0;
        const state = await scrapeStateStorage.getValue();
        await scrapeStateStorage.setValue({ ...state, isRunning: false, lastError: msg.error });
        const errorType = (msg.errorType ?? 'generic') as 'logout' | 'timeout' | 'cancelled' | 'generic';
        broadcastToContexts({ type: 'SCRAPE_FAILED', errorType, error: msg.error ?? '' });
        await scheduleNextAlarm();
        sendResponse({ ok: true });
      })();
      return true;
    }

    // 用户手动中止采集 → 通知 content script 设置取消标志（不再导航 about:blank）
    if (msg.type === 'CANCEL_SCRAPE') {
      (async () => {
        cycleStartedAt = 0;
        cycleUsageAdded = 0;
        await pendingSlowScrapeStorage.setValue(false); // 清除待触发的 token 采集，防止下次普通采集意外触发
        // 如果慢速采集也在运行，一并取消（防止用户点 StatusBar abort 时慢速采集游离）
        if (slowRunning) {
          const tabToCancel = slowTabId ?? await dashboardTabIdStorage.getValue();
          if (tabToCancel !== null) {
            chrome.tabs.sendMessage(tabToCancel, { type: 'SLOW_SCRAPE_CANCEL' }).catch(() => {});
          }
          slowRunning = false;
          slowTabId   = null;
          slowBreakdownAccum = {};
          await slowScrapeStateStorage.setValue({ isRunning: false, currentPage: 0, totalPages: 0, startedAt: null });
          await pushInboxMessage({
            id: makeId(), ts: new Date().toISOString(), kind: 'error',
            text: '✗ 慢速采集已手动取消，数据已全部抛弃',
          });
        }
        const state = await scrapeStateStorage.getValue();
        await scrapeStateStorage.setValue({ ...state, isRunning: false, lastError: 'cancelled' });
        // 向 content script 发取消标志，让它在下一个检查点自行中止
        // 不再导航 about:blank，保持 tab 可用（测试/后续采集不受影响）
        const savedId = await dashboardTabIdStorage.getValue();
        if (savedId !== null) {
          chrome.tabs.sendMessage(savedId, { type: 'CANCEL_SCRAPE' }).catch(() => {
            // content script 已完成或不在线，忽略
          });
        }
        broadcastToContexts({ type: 'SCRAPE_FAILED', errorType: 'cancelled', error: '手动中止采集' });
        sendResponse({ ok: true });
      })();
      return true;
    }

    // ── 慢速采集：用户触发 ────────────────────────────────────────────────────
    if (msg.type === 'SLOW_SCRAPE_START') {
      (async () => {
        if (slowRunning) { sendResponse({ ok: false, reason: 'already running' }); return; }
        await startSlowScrape();
        sendResponse({ ok: true });
      })();
      return true;
    }

    // ── 慢速采集：用户取消 ────────────────────────────────────────────────────
    if (msg.type === 'SLOW_SCRAPE_CANCEL') {
      (async () => {
        // ⚠️ 不依赖 slowRunning 状态——即使 background 误判"已完成"也必须能 cancel
        // 始终尝试向 content script 发取消信号
        const tabToCancel = slowTabId ?? await dashboardTabIdStorage.getValue();
        if (tabToCancel !== null) {
          chrome.tabs.sendMessage(tabToCancel, { type: 'SLOW_SCRAPE_CANCEL' }).catch(() => {});
        }

        // 清理 SW 侧所有状态
        slowRunning = false;
        slowTabId   = null;
        slowBreakdownAccum = {}; // 取消 → 抛弃所有已累积的 breakdown 数据
        await slowScrapeStateStorage.setValue({ isRunning: false, currentPage: 0, totalPages: 0, startedAt: null });

        await pushInboxMessage({
          id: makeId(), ts: new Date().toISOString(), kind: 'error',
          text: '✗ 慢速采集已手动取消，数据已全部抛弃',
        });
        broadcastToContexts({ type: 'SLOW_SCRAPE_FAILED_SLOW', reason: '手动取消', errorType: 'cancelled' });
        sendResponse({ ok: true });
      })();
      return true;
    }

    // ── 慢速采集：content script 上报每页进度 ────────────────────────────────
    if (msg.type === 'SLOW_SCRAPE_PAGE') {
      (async () => {
        // 若携带 error，表示中断
        if ((msg as { error?: string }).error) {
          const reason = (msg as { error?: string }).error!;
          slowRunning = false;
          slowTabId   = null;
          slowBreakdownAccum = {}; // 中断 → 抛弃所有已累积数据
          await slowScrapeStateStorage.setValue({ isRunning: false, currentPage: 0, totalPages: 0, startedAt: null });

          const isLogout = reason.includes('退出登录');
          await pushInboxMessage({
            id: makeId(), ts: new Date().toISOString(), kind: 'error',
            text: `✗ 采集中断：${reason}，数据已全部抛弃`,
          });
          broadcastToContexts({
            type: 'SLOW_SCRAPE_FAILED_SLOW',
            reason,
            errorType: isLogout ? 'logout' : 'cancelled',
          });
          sendResponse({ ok: true });
          return;
        }

        const { page, totalPages, rowsUpdated, breakdown } = msg as {
          page: number; totalPages: number; rowsUpdated: number; breakdown: Record<string, TokenBreakdown>;
        };

        // 累积到内存（只有 SLOW_SCRAPE_ALL_DONE 才真正写 storage）
        for (const [key, val] of Object.entries(breakdown)) {
          slowBreakdownAccum[key] = val;
        }
        const accumulatedRows = Object.keys(slowBreakdownAccum).length;

        // 更新慢速采集进度状态
        await slowScrapeStateStorage.setValue({
          isRunning:   true,
          currentPage: page,
          totalPages:  totalPages || page,
          startedAt:   null,
        });

        // 推 inbox 进度消息（不在这里结束，等 SLOW_SCRAPE_ALL_DONE）
        await pushInboxMessage({
          id: makeId(), ts: new Date().toISOString(), kind: 'progress',
          text: `第 ${page}${totalPages > 0 ? `/${totalPages}` : ''} 页完成，本页 hover ${rowsUpdated} 行，累积 ${accumulatedRows} 条`,
          page,
          totalPages: totalPages || page,
          rowsUpdated,
        });

        sendResponse({ ok: true });
      })();
      return true;
    }

    // ── 慢速采集：content script 全部页面自然完成 ─────────────────────────────
    if (msg.type === 'SLOW_SCRAPE_ALL_DONE') {
      (async () => {
        // 一次性将所有累积数据写入 storage
        const saved = await mergeBreakdown(slowBreakdownAccum);
        slowBreakdownAccum = {};
        slowRunning = false;
        slowTabId   = null;
        const state = await slowScrapeStateStorage.getValue();
        await slowScrapeStateStorage.setValue({ isRunning: false, currentPage: state.currentPage, totalPages: state.totalPages, startedAt: null });
        // 防御性清除 scrapeStateStorage.isRunning（不应为 true，但若意外被设置则清掉）
        const scrapeState = await scrapeStateStorage.getValue();
        if (scrapeState.isRunning) {
          await scrapeStateStorage.setValue({ ...scrapeState, isRunning: false });
        }

        await pushInboxMessage({
          id: makeId(), ts: new Date().toISOString(), kind: 'success',
          text: `✓ 全部 ${state.currentPage} 页采集完成，写入 ${saved} 条 Token 明细`,
          page: state.currentPage,
          totalPages: state.totalPages,
          rowsUpdated: saved,
        });
        broadcastToContexts({ type: 'SLOW_SCRAPE_DONE', totalUpdated: saved });
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

    // 「更新数据(含输入输出)」：普通采集 + 采集完成后自动触发慢速 Token 采集
    if (msg.type === 'TRIGGER_SCRAPE_WITH_TOKEN') {
      (async () => {
        await checkAndResetStaleCycle();
        const state = await scrapeStateStorage.getValue();
        if (state.isRunning) { sendResponse({ ok: false, reason: 'already running' }); return; }

        await pendingSlowScrapeStorage.setValue(true);

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
        await scheduleNextAlarm();
        sendResponse({ ok: true });
      })();
      return true;
    }

    // 侧边栏已打开：重置指数衰减，立即按基准间隔重新调度（不触发采集）
    if (msg.type === 'REACTIVATE_AUTO') {
      (async () => {
        const mode = await scrapeModeStorage.getValue();
        if (mode === 'manual') { sendResponse({ ok: false }); return; }

        const state = await scrapeStateStorage.getValue();
        if (state.noDataCount > 0) {
          await scrapeStateStorage.setValue({ ...state, noDataCount: 0 });
          await scheduleNextAlarm();
          console.log('[cursor-stats] REACTIVATE_AUTO: decay reset, alarm rescheduled');
        }
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

    // 测试：转发 hover 命令到 dashboard tab 里的 content script
    if (msg.type === 'TEST_TOKEN_HOVER') {
      (async () => {
        const tabId = await findUsageTab();
        if (tabId === null) {
          broadcastToContexts({
            type: 'TOKEN_HOVER_RESULT',
            html: null, triggerText: '', parsed: null, portalCount: 0,
            error: '未找到 usage 标签页（请先在浏览器打开 cursor.com/dashboard/usage）',
          });
          sendResponse({ ok: false });
          return;
        }
        chrome.tabs.sendMessage(tabId, { type: 'TEST_TOKEN_HOVER' }).catch((e: unknown) => {
          broadcastToContexts({
            type: 'TOKEN_HOVER_RESULT',
            html: null, triggerText: '', parsed: null, portalCount: 0,
            error: `tabs.sendMessage 失败: ${String(e)}`,
          });
        });
        sendResponse({ ok: true });
      })();
      return true;
    }

    // 测试结果：从 content script 收到后广播给侧边栏
    if (msg.type === 'TOKEN_HOVER_RESULT') {
      broadcastToContexts(msg);
      return false;
    }

    // 测试：转发用户信息查询到 dashboard tab
    if (msg.type === 'TEST_USER_INFO') {
      (async () => {
        const tabId = await findUsageTab();
        if (tabId === null) {
          broadcastToContexts({ type: 'USER_INFO_RESULT', name: '', plan: '', error: '未找到 usage/dashboard 标签页' });
          sendResponse({ ok: false });
          return;
        }
        chrome.tabs.sendMessage(tabId, { type: 'TEST_USER_INFO' }).catch((e: unknown) => {
          broadcastToContexts({ type: 'USER_INFO_RESULT', name: '', plan: '', error: `tabs.sendMessage 失败: ${String(e)}` });
        });
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (msg.type === 'USER_INFO_RESULT') {
      broadcastToContexts(msg);
      return false;
    }

    // ── Spending 页面测试：转发到 dashboard tab ────────────────────────────────
    const SPENDING_TEST_MSGS = [
      'TEST_SPENDING_PLAN', 'TEST_INCLUDED_USAGE', 'TEST_ON_DEMAND',
    ] as const;
    type SpendingTestType = typeof SPENDING_TEST_MSGS[number];

    if (SPENDING_TEST_MSGS.includes(msg.type as SpendingTestType)) {
      (async () => {
        // 优先直接查 spending tab（不依赖 dashboardTabId 是否已更新）
        const spendingTabId = await findSpendingTab();
        const tabId = spendingTabId ?? await dashboardTabIdStorage.getValue();
        const errorResultType = {
          TEST_SPENDING_PLAN:    'SPENDING_PLAN_RESULT',
          TEST_INCLUDED_USAGE:   'INCLUDED_USAGE_RESULT',
          TEST_ON_DEMAND:        'ON_DEMAND_RESULT',
        }[msg.type as SpendingTestType];

        if (tabId === null) {
          broadcastToContexts({ type: errorResultType, error: '未找到 spending tab，请先打开 cursor.com/*/dashboard/spending' } as never);
          sendResponse({ ok: false });
          return;
        }
        chrome.tabs.sendMessage(tabId, msg).catch((e: unknown) => {
          broadcastToContexts({ type: errorResultType, error: `tabs.sendMessage 失败: ${String(e)}` } as never);
        });
        sendResponse({ ok: true });
      })();
      return true;
    }

    const SPENDING_RESULT_MSGS = [
      'SPENDING_PLAN_RESULT', 'INCLUDED_USAGE_RESULT', 'ON_DEMAND_RESULT', 'INTERRUPT_RESULT',
    ] as const;
    if (SPENDING_RESULT_MSGS.includes(msg.type as typeof SPENDING_RESULT_MSGS[number])) {
      broadcastToContexts(msg);
      return false;
    }

    // ── 中断模拟测试：转发到任意可用的 dashboard tab ───────────────────────────
    if (msg.type === 'TEST_INTERRUPT') {
      (async () => {
        const spendingTabId = await findSpendingTab();
        const tabId = spendingTabId ?? await dashboardTabIdStorage.getValue();
        if (tabId === null) {
          broadcastToContexts({
            type: 'INTERRUPT_RESULT',
            scenario:      (msg as { scenario: string }).scenario,
            dataCollected: 0,
            interrupted:   false,
            reason:        '未找到任何 dashboard tab，请先打开 cursor.com dashboard',
            checks:        {},
          } as never);
          sendResponse({ ok: false });
          return;
        }
        chrome.tabs.sendMessage(tabId, msg).catch((e: unknown) => {
          broadcastToContexts({
            type: 'INTERRUPT_RESULT',
            scenario:      (msg as { scenario: string }).scenario,
            dataCollected: 0,
            interrupted:   false,
            reason:        `tabs.sendMessage 失败: ${String(e)}`,
            checks:        {},
            error:         String(e),
          } as never);
        });
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
      // 采集进行中被关闭 → 广播 SCRAPE_FAILED 让侧边栏显示错误，而不是静默重置
      broadcastToContexts({ type: 'SCRAPE_FAILED', errorType: 'cancelled', error: '后台标签页被关闭，采集已中止' });
      await scheduleNextAlarm();
    }
  });

  // ── Tab 监听：监听所有 cursor.com tab，任意 dashboard tab 都可唤醒采集 ────────
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab.url) return;
    if (!tab.url.includes('cursor.com') && !tab.url.includes('cursor.sh')) return;

    const savedId = await dashboardTabIdStorage.getValue();
    const state   = await scrapeStateStorage.getValue();

    // ── 快速中断：后台 tab 在采集进行中导航离开 dashboard（退出登录等）──────────
    // 用 loading 状态（而非 complete）立刻捕获，不等页面加载完成
    // 原因：content script 被 navigation kill 时不会再发消息，isRunning 会永远卡住
    if (
      changeInfo.status === 'loading' &&
      tabId === savedId &&
      state.isRunning &&
      !tab.url.includes('/dashboard/')
    ) {
      cycleStartedAt = 0;
      cycleUsageAdded = 0;
      const loginRelated = isAuthRedirect(tab.url);
      await scrapeStateStorage.setValue({
        ...state,
        isRunning: false,
        loginRequired: loginRelated,
      });
      // 退出登录/导航离开 → 统一广播 SCRAPE_FAILED（errorType: 'logout'）
      // content script 上下文已被 navigation 销毁，不会再发任何消息，必须由 background 兜底
      broadcastToContexts({ type: 'SCRAPE_FAILED', errorType: 'logout', error: '采集中途离开 dashboard（退出登录或跳转）' });
      if (loginRelated) {
        await scheduleLoginRetry();
      } else {
        await scheduleNextAlarm();
      }
      console.log(`[cursor-stats] scrape aborted: tab ${tabId} left dashboard (login=${loginRelated})`);
      return;
    }

    if (changeInfo.status !== 'complete') return;

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
    if (newMode === 'auto' || newMode === 'auto_calm') {
      await scheduleNextAlarm();
    } else {
      await chrome.alarms.clear('scrape');
    }
  });

  console.log('[cursor-stats] background ready');

  /* ── DEV 热重载验证心跳 ── 需要时取消注释，验证完重新注释 ─────────────────────
  if (import.meta.env.DEV) {
    console.log(`%c[dev] background (re)loaded @ ${new Date().toLocaleTimeString()}`, 'color: #4ade80; font-weight: bold');
    let beat = 0;
    setInterval(() => {
      console.log(`[dev] heartbeat #${++beat} @ ${new Date().toLocaleTimeString()}`);
    }, 5000);
  }
  ── END DEV TEST ──────────────────────────────────────────────────────────── */
});
