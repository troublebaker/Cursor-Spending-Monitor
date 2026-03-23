import type { LocaleDict } from '../utils/i18n/zh-CN';
import type { ScrapeMode } from '../utils/types';

interface Props {
  t: LocaleDict;
  isRunning: boolean;
  loginRequired: boolean;
  lastScrapeAt: string | null;
  scrapeMode: ScrapeMode;
  noDataCount: number;      // 用于显示下次更新间隔
  onModeChange: (mode: ScrapeMode) => void;
  onScrapeNow: () => void;
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '<1m';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

function nextIntervalLabel(noDataCount: number): string {
  const min = Math.min(Math.pow(2, noDataCount), 60);
  return min >= 60 ? '60m' : `${min}m`;
}

export function StatusBar({
  t, isRunning, loginRequired, lastScrapeAt, scrapeMode, noDataCount,
  onModeChange, onScrapeNow,
}: Props) {
  // 状态文字
  const statusText = loginRequired
    ? t.statusWaiting
    : isRunning
      ? t.statusCollecting
      : lastScrapeAt
        ? `${t.lastUpdated} ${timeAgoShort(lastScrapeAt)}`
        : t.statusIdle;

  const dotCls = loginRequired
    ? 'bg-yellow-400'
    : isRunning
      ? 'bg-blue-500 animate-pulse'
      : 'bg-zinc-300 dark:bg-zinc-600';

  const textCls = loginRequired
    ? 'text-yellow-500'
    : isRunning
      ? 'text-blue-500'
      : 'text-zinc-400 dark:text-zinc-500';

  return (
    <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs bg-white dark:bg-zinc-900">
      {/* 左：状态 */}
      <span className={`flex items-center gap-1.5 ${textCls}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
        <span className="truncate max-w-[120px]">{statusText}</span>
      </span>

      {/* 右：模式 + 下次间隔 + 采集按钮 */}
      <div className="flex items-center gap-2 shrink-0">
        {/* 自动模式下显示下次更新时间 */}
        {scrapeMode === 'auto' && !isRunning && (
          <span className="text-zinc-400 dark:text-zinc-600">
            {t.nextUpdate} {nextIntervalLabel(noDataCount)}
          </span>
        )}

        {/* 模式下拉 */}
        <select
          value={scrapeMode}
          onChange={e => onModeChange(e.target.value as ScrapeMode)}
          className="text-xs bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 cursor-pointer"
        >
          <option value="auto">{t.scrapeModeAuto}</option>
          <option value="manual">{t.scrapeModeManual}</option>
        </select>

        {/* 立即采集按钮 */}
        <button
          onClick={onScrapeNow}
          disabled={isRunning}
          title={t.scrapeNow}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 disabled:opacity-40 transition-colors text-base leading-none"
        >
          ↻
        </button>
      </div>
    </div>
  );
}
