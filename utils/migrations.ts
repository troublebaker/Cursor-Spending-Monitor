import { storage } from 'wxt/utils/storage';
import { usageStorage, schemaVersionStorage } from './storage';
import type { UsageRecord } from './types';

const CURRENT_VERSION = 1;

/**
 * 在 background.ts 启动时调用一次。
 * 按版本号顺序执行所有待跑的迁移，最后更新 schemaVersion。
 */
export async function runMigrations(): Promise<void> {
  const v = await schemaVersionStorage.getValue();

  if (v < 1) {
    // v0 → v1：旧 key 'local:usage' → 新 key 'local:usageRecords'
    const old = await storage.getItem<UsageRecord[]>('local:usage');
    if (old && old.length > 0) {
      await usageStorage.setValue(old);
      await storage.removeItem('local:usage');
      console.log('[cursor-stats] migration v0→v1: moved local:usage →  local:usageRecords');
    }
  }

  // 未来迁移示例：
  // if (v < 2) { ... }

  await schemaVersionStorage.setValue(CURRENT_VERSION);
}
