import { useState, useEffect, useRef } from 'react';
import type { LocaleDict } from '../utils/i18n/zh-CN';
import type { ScrapeMode } from '../utils/types';
import { Tooltip } from './Tooltip';

interface Props {
  t: LocaleDict;
  isRunning: boolean;
  slowScrapeRunning: boolean;
  loginRequired: boolean;
  lastScrapeAt: string | null;
  scrapeMode: ScrapeMode;
  noDataCount: number;
  lastResult: { ok: boolean; added: number; errorType?: string } | null;
  autoIncludeToken: boolean;
  onModeChange: (mode: ScrapeMode) => void;
  onScrapeNow: () => void;
  onScrapeWithToken: () => void;
  onAbort: () => void;
  onClearData: () => void;
  onAutoIncludeTokenChange: (v: boolean) => void;
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '<1m';
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h`;
}

function nextIntervalLabel(noDataCount: number, mode: ScrapeMode): string {
  const baseMin = mode === 'auto_calm' ? 5 : 1;
  const min = Math.min(baseMin * Math.pow(2, noDataCount), 60);
  return min >= 60 ? '60m' : `${min}m`;
}

function getStageText(elapsedSec: number, t: LocaleDict): string {
  if (elapsedSec < 4)  return t.stagePage;
  if (elapsedSec < 13) return t.stageUsage;
  return t.stageSpending;
}

const MODE_TOOLTIPS = (t: LocaleDict): Record<ScrapeMode, string> => ({
  auto:      t.modeTooltipAuto,
  auto_calm: t.modeTooltipCalm,
  manual:    t.modeTooltipManual,
});

const TOKEN_TIP = (t: LocaleDict) => t.tokenTip;

const SCRAPE_WITH_TOKEN_TIP = (t: LocaleDict) => t.scrapeWithTokenTip;

export function StatusBar({
  t, isRunning, slowScrapeRunning, loginRequired, lastScrapeAt, scrapeMode, noDataCount,
  lastResult, autoIncludeToken, onModeChange, onScrapeNow, onScrapeWithToken,
  onAbort, onClearData, onAutoIncludeTokenChange,
}: Props) {
  const [progress,     setProgress]     = useState(0);
  const [stageText,    setStageText]    = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const startTimeRef    = useRef<number | null>(null);
  const stageTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now();
      setProgress(10);
      const rId = requestAnimationFrame(() => setProgress(85));
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

  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  function handleClearClick() {
    if (confirmClear) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      setConfirmClear(false);
      onClearData();
    } else {
      setConfirmClear(true);
      confirmTimerRef.current = setTimeout(() => setConfirmClear(false), 3_000);
    }
  }

  function errorLabel(errorType: string | undefined): string {
    if (errorType === 'logout')    return t.errorLogout;
    if (errorType === 'timeout')   return t.errorTimeout;
    if (errorType === 'cancelled') return t.errorCancelled;
    return `✗ ${t.scrapeFailed}`;
  }

  const statusText = loginRequired
    ? t.statusWaiting
    : isRunning
      ? stageText || t.statusCollecting
      : lastResult
        ? lastResult.ok
          ? lastResult.added > 0
            ? `✓ +${lastResult.added} ${t.scrapeNewRecords}`
            : `✓ ${t.scrapeNoNew}`
          : errorLabel(lastResult.errorType)
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

        {/* 右：模式 + 下次间隔 + Token + 中止/清空 */}
        <div className="flex items-center gap-2 shrink-0">
          {(scrapeMode === 'auto' || scrapeMode === 'auto_calm') && !isRunning && (
            <span className="text-zinc-400 dark:text-zinc-600">
              {t.nextUpdate} {nextIntervalLabel(noDataCount, scrapeMode)}
            </span>
          )}

          {/* 模式选择 */}
          <Tooltip text={MODE_TOOLTIPS(t)[scrapeMode]} position="bottom" maxWidth={220}>
            <select
              value={scrapeMode}
              onChange={e => onModeChange(e.target.value as ScrapeMode)}
              className="text-xs bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 cursor-pointer"
            >
              <option value="auto">{t.scrapeModeAuto}</option>
              <option value="auto_calm">{t.scrapeModeAutoCalm}</option>
              <option value="manual">{t.scrapeModeManual}</option>
            </select>
          </Tooltip>

          {/* 自动含 Token 勾选框 */}
          {(scrapeMode === 'auto' || scrapeMode === 'auto_calm') && (
            <Tooltip text={TOKEN_TIP(t)} position="bottom" maxWidth={210}>
              <label className="flex items-center gap-0.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoIncludeToken}
                  onChange={e => onAutoIncludeTokenChange(e.target.checked)}
                  className="w-3 h-3 cursor-pointer accent-blue-500"
                />
                <span className="text-zinc-400 dark:text-zinc-500">+Token</span>
              </label>
            </Tooltip>
          )}

          {/* 中止 / 清空 */}
          {(isRunning || slowScrapeRunning) ? (
            <Tooltip text={t.abortTooltip} position="bottom">
              <button
                onClick={onAbort}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition-colors text-sm leading-none font-bold"
              >
                ✕
              </button>
            </Tooltip>
          ) : (
            <Tooltip
              text={confirmClear ? t.clearConfirmTooltip : t.clearDataTooltip}
              position="bottom"
              maxWidth={140}
            >
              <button
                onClick={handleClearClick}
                className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors text-sm leading-none ${
                  confirmClear
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/60'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {confirmClear ? '?' : '🗑'}
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* 第二行：更新按钮 */}
      {!isRunning && !slowScrapeRunning && !loginRequired && (
        <div className="px-3 pb-2 flex gap-2">
          <button
            onClick={onScrapeNow}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-brand text-white hover:opacity-90 active:opacity-75 transition-opacity"
          >
            {t.scrapeNow}
          </button>
          <Tooltip text={SCRAPE_WITH_TOKEN_TIP(t)} position="top" maxWidth={200} className="flex-1">
            <button
              onClick={onScrapeWithToken}
              className="w-full py-1.5 text-xs font-medium rounded-lg bg-brand/80 text-white hover:opacity-90 active:opacity-75 transition-opacity"
            >
              {t.scrapeNowWithToken}
            </button>
          </Tooltip>
        </div>
      )}

      {/* 进度条 */}
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
