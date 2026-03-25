import type { UsageRecord, SpendingData } from './types';
import { usageStorage, spendingStorage, scrapeStateStorage } from './storage';

// ─── Usage 去重合并 ────────────────────────────────────────────────────────────

/** 去重 key：包含 accountId，确保不同账号的同一条记录不互相去重 */
function recordKey(r: UsageRecord): string {
  return `${r.dt}|${r.model}|${r.type}|${r.tokens}|${r.accountId ?? ''}`;
}

/**
 * 将新记录合并进本地存储，跳过重复项。
 * @returns 实际写入的新增条数
 */
export async function mergeRecords(newRecords: UsageRecord[]): Promise<number> {
  if (newRecords.length === 0) return 0;

  const existing = await usageStorage.getValue();
  const existingKeys = new Set(existing.map(recordKey));

  const added = newRecords.filter(r => !existingKeys.has(recordKey(r)));
  if (added.length === 0) return 0;

  // 按时间降序排列（最新在前，方便增量早停）
  const merged = [...added, ...existing].sort((a, b) => b.dt.localeCompare(a.dt));
  await usageStorage.setValue(merged);
  return added.length;
}

/** 返回指定账号最新一条记录的时间，用于增量爬取的 cutoff。
 *  传入 accountId 时只看该账号的数据，避免跨账号污染 cutoff。
 */
export async function getLatestDt(accountId?: string): Promise<Date | null> {
  const records = await usageStorage.getValue();
  const scoped = accountId ? records.filter(r => r.accountId === accountId) : records;
  if (scoped.length === 0) return null;
  // records 已按 dt 降序排列，取第一条即为最新
  const d = new Date(scoped[0].dt);
  // 防御：若 dt 格式无法被 V8 解析（Invalid Date），降级为全量采集
  if (isNaN(d.getTime())) return null;
  return d;
}

// ─── Spending 直接覆盖 ─────────────────────────────────────────────────────────

/** Spending 数据直接覆盖（每次全量更新） */
export async function saveSpending(data: SpendingData): Promise<void> {
  await spendingStorage.setValue(data);
}

// ─── 采集状态辅助 ──────────────────────────────────────────────────────────────

/** 采集结束后更新 state，并按「有无新数据」更新指数衰减计数 */
export async function onScrapeComplete(addedCount: number): Promise<void> {
  const prev = await scrapeStateStorage.getValue();
  const noDataCount = addedCount === 0 ? prev.noDataCount + 1 : 0;
    await scrapeStateStorage.setValue({
      lastScrapeAt: new Date().toISOString(),
      lastError: null,
      isRunning: false,
      noDataCount,
      loginRequired: false,
    });
}

/** 计算下次采集等待时间（分钟），基准 1 min × 2^noDataCount，上限 60 min */
export function nextIntervalMin(noDataCount: number, baseMin = 1): number {
  const raw = baseMin * Math.pow(2, noDataCount);
  return Math.min(raw, 60);
}
