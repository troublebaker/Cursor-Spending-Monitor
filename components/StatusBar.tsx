import { useState, useEffect, useRef } from 'react';
import type { LocaleDict } from '../utils/i18n/zh-CN';
import type { ScrapeMode } from '../utils/types';

interface Props {
  t: LocaleDict;
  isRunning: boolean;
  loginRequired: boolean;
  lastScrapeAt: string | null;
  scrapeMode: ScrapeMode;
  noDataCount: number;
  lastResult: { ok: boolean; added: number } | null;
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

// 阶段文字：根据采集开始后的秒数返回对应阶段提示
function getStageText(elapsedSec: number, t: LocaleDict): string {
  if (elapsedSec < 4) return t.stagePage;
  if (elapsedSec < 13) return t.stageUsage;
  return t.stageSpending;
}

export function StatusBar({
  t, isRunning, loginRequired, lastScrapeAt, scrapeMode, noDataCount,
  lastResult, onModeChange, onScrapeNow,
}: Props) {
  // ── 假进度条（CSS transition 驱动） ──────────────────────────────────────────
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const startTimeRef = useRef<number | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now();
      // 第一帧：10%（立即）→ 下一帧：85%（15s ease-out CSS transition）
      setProgress(10);
      const rId = requestAnimationFrame(() => setProgress(85));
      // 阶段文字定时更新
      setStageText(t.stagePage);
      stageTimerRef.current = setInterval(() => {
        const elapsed = startTimeRef.current
          ? (Date.now() - startTimeRef.current) / 1000
          : 0;
        setStageText(getStageText(elapsed, t));
      }, 1000);
      return () => {
        cancelAnimationFrame(rId);
        if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      };
    } else {
      // 采集结束：snap to 100%, then reset
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      setStageText('');
      if (progress > 0) {
        setProgress(100);
        const id = setTimeout(() => setProgress(0), 900);
        return () => clearTimeout(id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // ── 状态文字 ──────────────────────────────────────────────────────────────────
  const statusText = loginRequired
    ? t.statusWaiting
    : isRunning
      ? stageText || t.statusCollecting
      : lastResult
        ? lastResult.ok
          ? lastResult.added > 0
            ? `✓ +${lastResult.added} ${t.scrapeNewRecords}`
            : `✓ ${t.scrapeNoNew}`
          : `✗ ${t.scrapeFailed}`
        : lastScrapeAt
          ? `${t.lastUpdated} ${timeAgoShort(lastScrapeAt)}`
          : t.statusIdle;

  const dotCls = loginRequired
    ? 'bg-yellow-400'
    : isRunning
      ? 'bg-blue-500 animate-pulse'
      : lastResult?.ok === false
        ? 'bg-red-400'
        : 'bg-zinc-300 dark:bg-zinc-600';

  const textCls = loginRequired
    ? 'text-yellow-500'
    : isRunning
      ? 'text-blue-500'
      : lastResult?.ok === false
        ? 'text-red-500'
        : lastResult?.ok === true
          ? 'text-green-500 dark:text-green-400'
          : 'text-zinc-400 dark:text-zinc-500';

  // 进度条颜色：成功=brand，失败=red
  const barColor = !isRunning && lastResult?.ok === false
    ? '#ef4444'
    : 'var(--color-brand)';

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      {/* 主行 */}
      <div className="px-4 py-2 flex items-center justify-between text-xs">
        {/* 左：状态 */}
        <span className={`flex items-center gap-1.5 ${textCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
          <span className="truncate max-w-[140px]">{statusText}</span>
        </span>

        {/* 右：模式 + 下次间隔 + 采集按钮 */}
        <div className="flex items-center gap-2 shrink-0">
          {scrapeMode === 'auto' && !isRunning && (
            <span className="text-zinc-400 dark:text-zinc-600">
              {t.nextUpdate} {nextIntervalLabel(noDataCount)}
            </span>
          )}
          <select
            value={scrapeMode}
            onChange={e => onModeChange(e.target.value as ScrapeMode)}
            className="text-xs bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 cursor-pointer"
          >
            <option value="auto">{t.scrapeModeAuto}</option>
            <option value="manual">{t.scrapeModeManual}</option>
          </select>
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

      {/* 进度条（3px 高，CSS transition 驱动） */}
      <div
        style={{
          height: 3,
          width: `${progress}%`,
          backgroundColor: barColor,
          transition: isRunning
            ? 'width 15s ease-out'
            : 'width 0.4s ease-in, background-color 0.2s',
          opacity: progress > 0 ? 1 : 0,
        }}
      />
    </div>
  );
}
