export interface UsageRecord {
  dt: string;      // "2026-03-15 14:32:00" CST
  type: string;    // "On-Demand" | "Included (Pro)"
  model: string;   // "claude-4.6-sonnet" | ...
  tokens: number;
  cost: number;    // USD，4 位小数；Included 类型为 0
}

export interface SpendingData {
  scrapedAt: string;    // ISO 时间戳
  planName: string;     // "Pro"
  planPrice: string;    // "$20/month"
  resetDate: string;    // "2026-04-01"
  totalPct: number;     // 0–100
  autoPct: number;
  apiPct: number;
  demandUsed: number;   // USD
  demandLimit: number;  // USD（Pro=50, Pro+=400）
}

export interface Settings {
  alertThreshold: number;    // 默认 20，每 $N 提醒一次
  scrapeIntervalMin: number; // 默认 60
  mode: 'auto' | 'manual';
  alertsAcked: number[];     // 已确认告警阈值列表
}

export interface ScrapeState {
  lastScrapeAt: string | null;
  lastError: string | null;
  isRunning: boolean;
}
