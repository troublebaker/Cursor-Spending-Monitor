import { storage } from 'wxt/utils/storage';
import type { UsageRecord, SpendingData, Settings, ScrapeState } from './types';

// ⚠️ key 命名规范：'local:camelCase'，修改 key 时必须写迁移函数

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
      scrapeIntervalMin: 60,
      mode: 'auto',
      alertsAcked: [],
    },
  },
);

export const scrapeStateStorage = storage.defineItem<ScrapeState>(
  'local:scrapeState',
  { fallback: { lastScrapeAt: null, lastError: null, isRunning: false } },
);

export const schemaVersionStorage = storage.defineItem<number>(
  'local:schemaVersion',
  { fallback: 0 },
);
