// ─── 数据模型 ────────────────────────────────────────────────────────────────

export interface UsageRecord {
  dt: string;      // "2026-03-15 14:32:00" CST
  type: string;    // "On-Demand" | "Included (Pro)"
  model: string;   // "claude-4.6-sonnet" | ...
  tokens: number;
  cost: number;    // USD，4 位小数；Included 类型为 0
}

export interface SpendingData {
  scrapedAt: string;
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
  scrapeIntervalMin: number; // 默认 1（auto 模式基准间隔）
  mode: ScrapeMode;
  alertsAcked: number[];
}

export interface ScrapeState {
  lastScrapeAt: string | null;
  lastError: string | null;
  isRunning: boolean;
  noDataCount: number;       // 连续无新数据次数，用于指数衰减
  loginRequired: boolean;    // 未登录状态，用于侧边栏初始化时读取
}

// ─── F04 新增 ─────────────────────────────────────────────────────────────────

/** 采集模式 */
export type ScrapeMode = 'auto' | 'manual';

/** content script ↔ background 消息协议（完整枚举） */
export type ExtMessage =
  // content → background：数据上报
  | { type: 'USAGE_DATA';    records: UsageRecord[]; isIncremental: boolean }
  | { type: 'SPENDING_DATA'; spending: SpendingData }
  | { type: 'SCRAPE_ERROR';  error: string; page: 'usage' | 'spending' }
  // content → background：登录状态
  | { type: 'NOT_LOGGED_IN' }
  | { type: 'LOGIN_RESTORED' }
  // content → background：页面就绪，请求采集参数（background 通过 sendResponse 回复）
  | { type: 'PAGE_READY'; page: 'usage' | 'spending' }
  // sidepanel → background：触发立即采集 / 重新调度 alarm
  | { type: 'TRIGGER_SCRAPE' }
  // background → sidepanel：状态通知
  | { type: 'TAB_CLOSED' }
  | { type: 'TAB_OPENED';    tabId: number }
  | { type: 'SCRAPE_STATUS'; isRunning: boolean; lastScrapeAt: string | null }
  | { type: 'LOGIN_REQUIRED' };

/** background 对 PAGE_READY 的同步响应体（不在 ExtMessage 内，是 sendResponse 值） */
export interface ScrapeParams {
  isIncremental: boolean;
  cutoffIso: string | null;
}
