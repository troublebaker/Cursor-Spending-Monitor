import { storage } from 'wxt/utils/storage';
import type { UsageRecord, SpendingData, Settings, ScrapeState, ScrapeMode, InboxMessage, SlowScrapeState } from './types';

// ⚠️ key 命名规范：'local:camelCase'，修改 key 必须写迁移函数

// ─── 核心数据 ─────────────────────────────────────────────────────────────────

export const usageStorage = storage.defineItem<UsageRecord[]>(
  'local:usageRecords',
  { fallback: [] },
);

export const spendingStorage = storage.defineItem<SpendingData | null>(
  'local:spending',
  { fallback: null },
);

export const settingsStorage = storage.defineItem<Settings>(
  'local:settings',
  {
    fallback: {
      alertThreshold: 20,
      scrapeIntervalMin: 1,  // auto 模式基准：1 分钟
      mode: 'auto' as ScrapeMode,
      alertsAcked: [],
    },
  },
);

export const scrapeStateStorage = storage.defineItem<ScrapeState>(
  'local:scrapeState',
  {
    fallback: {
      lastScrapeAt: null,
      lastError: null,
      isRunning: false,
      noDataCount: 0,
      loginRequired: false,
    },
  },
);

export const schemaVersionStorage = storage.defineItem<number>(
  'local:schemaVersion',
  { fallback: 0 },
);

// ─── F04 新增 ─────────────────────────────────────────────────────────────────

/** 常驻采集 tab 的 ID，null 表示尚未创建 */
export const dashboardTabIdStorage = storage.defineItem<number | null>(
  'local:dashboardTabId',
  { fallback: null },
);

/** 采集模式：auto（1min + 指数衰减）| manual */
export const scrapeModeStorage = storage.defineItem<ScrapeMode>(
  'local:scrapeMode',
  { fallback: 'auto' },
);

/** 用户是否选择「tab 关闭后不再提示」 */
export const noTabReminderStorage = storage.defineItem<boolean>(
  'local:noTabReminder',
  { fallback: false },
);

/** 用户是否已完成首次引导 */
export const onboardedStorage = storage.defineItem<boolean>(
  'local:onboarded',
  { fallback: false },
);

// ─── F05 新增 ─────────────────────────────────────────────────────────────────

/** 已知账号姓名，用于采集提交前的账号一致性校验 */
export const userNameStorage = storage.defineItem<string>(
  'local:knownUserName',
  { fallback: 'unknown' },
);

/** InboxPanel 消息列表（最多保留 100 条，新消息在前） */
export const inboxStorage = storage.defineItem<InboxMessage[]>(
  'local:inboxMessages',
  { fallback: [] },
);

/**
 * 「更新数据(含输入输出)」按钮触发标志：普通采集完成后自动开启慢速采集。
 * 慢速采集开始后清除此标志。
 */
export const pendingSlowScrapeStorage = storage.defineItem<boolean>(
  'local:pendingSlowScrape',
  { fallback: false },
);

/** 慢速 Token 采集运行状态 */
export const slowScrapeStateStorage = storage.defineItem<SlowScrapeState>(
  'local:slowScrapeState',
  {
    fallback: {
      isRunning:   false,
      currentPage: 0,
      totalPages:  0,
      startedAt:   null,
    },
  },
);
