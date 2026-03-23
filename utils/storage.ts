import { storage } from 'wxt/utils/storage';
import type { UsageRecord, SpendingData, Settings, ScrapeState, ScrapeMode } from './types';

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
