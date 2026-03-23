/**
 * 确定性 Mock 数据（使用线性同余生成器，seed=42，每次结果相同）
 * F04 完成后，将 App.tsx 中的 MOCK_* 替换为 storage 读取即可
 */
import type { UsageRecord, SpendingData } from './types';

/** 线性同余随机数生成器（seed 固定 → 输出固定） */
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s, 1664525) + 1013904223;
    return (s >>> 0) / 0x100000000;
  };
}

const rng = mkRng(42);

const MODELS = [
  'claude-4.6-sonnet',
  'claude-3.5-haiku',
  'claude-3-opus',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'o1-mini',
  'gemini-1.5-pro',
  'cursor-small',
  'deepseek-chat',
  'claude-2',
  'claude-3.5-sonnet',
];

const BASE_DATE = new Date('2026-03-01T00:00:00+08:00');

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function makeDt(dayOffset: number): string {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() + dayOffset);
  const h = Math.floor(rng() * 23);
  const m = Math.floor(rng() * 59);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(h)}:${pad2(m)}:00`;
}

function generateUsage(): UsageRecord[] {
  const records: UsageRecord[] = [];
  for (let day = 0; day < 30; day++) {
    const callsToday = 4 + Math.floor(rng() * 12); // 4–15 条/天
    for (let i = 0; i < callsToday; i++) {
      const model = MODELS[Math.floor(rng() * MODELS.length)];
      const isOnDemand = rng() > 0.65; // ~35% 按需
      const type = isOnDemand ? 'On-Demand' : 'Included (Pro)';
      const tokens = 800 + Math.floor(rng() * 12000);
      const cost = isOnDemand ? parseFloat((tokens * 0.000028).toFixed(4)) : 0;
      records.push({ dt: makeDt(day), type, model, tokens, cost });
    }
  }
  return records.sort((a, b) => b.dt.localeCompare(a.dt));
}

export const MOCK_USAGE: UsageRecord[] = generateUsage();

export const MOCK_SPENDING: SpendingData = {
  scrapedAt: '2026-03-23T10:00:00.000Z',
  planName: 'Pro',
  planPrice: '$20/month',
  resetDate: '2026-04-01',
  totalPct: 8.4,
  autoPct: 4.2,
  apiPct: 0.2,
  demandUsed: 4.2,
  demandLimit: 50,
};
