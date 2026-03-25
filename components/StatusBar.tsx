import { useState, useEffect, useRef } from 'react';
import type { LocaleDict } from '../utils/i18n/zh-CN';
import type { ScrapeMode } from '../utils/types';

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

// 阶段文字：根据采集开始后的秒数返回对应阶段提示
function getStageText(elapsedSec: number, t: LocaleDict): string {
  if (elapsedSec < 4) return t.stagePage;
  if (elapsedSec < 13) return t.stageUsage;
  return t.stageSpending;
}

export function StatusBar({
  t, isRunning, slowScrapeRunning, loginRequired, lastScrapeAt, scrapeMode, noDataCount,
  lastResult, autoIncludeToken, onModeChange, onScrapeNow, onScrapeWithToken,
  onAbort, onClearData, onAutoIncludeTokenChange,
}: Props) {
  // ── 假进度条（CSS transition 驱动） ──────────────────────────────────────────
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const startTimeRef = useRef<number | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 删除确认状态（首次点击高亮提示，再次点击执行）
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 删除确认超时清理
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

  // ── 错误类型 → 中文文字 ────────────────────────────────────────────────────
  function errorLabel(errorType: string | undefined): string {
    if (errorType === 'logout')    return '✗ 已登出，数据已丢弃';
    if (errorType === 'timeout')   return '✗ 已超时（15s），数据已丢弃';
    if (errorType === 'cancelled') return '✗ 已中止采集';
    return `✗ ${t.scrapeFailed}`;
  }

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

        {/* 右：模式 + 下次间隔 + 中止按钮（采集中） */}
        <div className="flex items-center gap-2 shrink-0">
          {(scrapeMode === 'auto' || scrapeMode === 'auto_calm') && !isRunning && (
            <span className="text-zinc-400 dark:text-zinc-600">
              {t.nextUpdate} {nextIntervalLabel(noDataCount, scrapeMode)}
            </span>
          )}
          <select
            value={scrapeMode}
            onChange={e => onModeChange(e.target.value as ScrapeMode)}
            title={
              scrapeMode === 'auto'
                ? '自动活跃：每隔 1 分钟查询一次；无新数据则指数衰减，最长间隔 60 分钟；重新点击「立即采集」可重置间隔'
                : scrapeMode === 'auto_calm'
                  ? '自动冷静：每隔 5 分钟查询一次；无新数据则指数衰减，最长间隔 60 分钟；重新点击「立即采集」可重置间隔'
                  : '手动模式：不自动查询，仅在点击「更新数据」时采集'
            }
            className="text-xs bg-transparent border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-zinc-600 dark:text-zinc-400 cursor-pointer"
          >
            <option value="auto">{t.scrapeModeAuto}</option>
            <option value="auto_calm">{t.scrapeModeAutoCalm}</option>
            <option value="manual">{t.scrapeModeManual}</option>
          </select>
          {/* 自动含 Token 勾选框（仅自动模式下显示） */}
          {(scrapeMode === 'auto' || scrapeMode === 'auto_calm') && (
            <label className="flex items-center gap-0.5 cursor-pointer select-none" title="勾选后每次自动采集完成后，同时采集每条记录的 Token 输入/输出明细（增量：已有数据的行会跳过）。逐行悬停读取，速度较慢，每页约 2~3 分钟，后台自动完成无需等待。">
              <input
                type="checkbox"
                checked={autoIncludeToken}
                onChange={e => onAutoIncludeTokenChange(e.target.checked)}
                className="w-3 h-3 cursor-pointer accent-blue-500"
              />
              <span className="text-zinc-400 dark:text-zinc-500">+Token</span>
            </label>
          )}
          {(isRunning || slowScrapeRunning) ? (
            <button
              onClick={onAbort}
              title="中止本次采集并丢弃数据"
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 transition-colors text-sm leading-none font-bold"
            >
              ✕
            </button>
          ) : (
            <button
              onClick={handleClearClick}
              title={confirmClear ? '再次点击确认清空所有记录' : '清空所有记录'}
              className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors text-sm leading-none ${
                confirmClear
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/60'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {confirmClear ? '?' : '🗑'}
            </button>
          )}
        </div>
      </div>

      {/* 第二行：更新按钮（仅非采集中时显示） */}
      {!isRunning && !slowScrapeRunning && !loginRequired && (
        <div className="px-3 pb-2 flex gap-2">
          <button
            onClick={onScrapeNow}
            title={t.scrapeNow}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-brand text-white hover:opacity-90 active:opacity-75 transition-opacity"
          >
            {t.scrapeNow}
          </button>
          <button
            onClick={onScrapeWithToken}
            title="先完成一次普通采集，再逐行悬停读取 Token 输入/输出明细（增量：已有数据的行跳过）。较慢，每页约 2~3 分钟，后台自动完成无需等待。"
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-brand/80 text-white hover:opacity-90 active:opacity-75 transition-opacity"
          >
            {t.scrapeNowWithToken}
          </button>
        </div>
      )}

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
