import { useState } from 'react';
import type { UsageRecord, SpendingData } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';
import { usageStorage, spendingStorage, scrapeStateStorage } from '../utils/storage';

interface Props {
  t: LocaleDict;
  usage: UsageRecord[];
  spending: SpendingData | null;
  currentMonth: string;
  monthRecordsCount: number;
  onDataCleared: () => void;
}

export function DebugPanel({ t, usage, spending, currentMonth, monthRecordsCount, onDataCleared }: Props) {
  const [open, setOpen]       = useState(false);
  const [copied, setCopied]   = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleClear() {
    if (!window.confirm(t.debugClearConfirm)) return;
    setClearing(true);
    await usageStorage.setValue([]);
    await spendingStorage.setValue(null);
    await scrapeStateStorage.setValue({
      isRunning: false,
      lastScrapeAt: null,
      lastError: null,
      noDataCount: 0,
    });
    setClearing(false);
    onDataCleared();
  }

  async function handleCopy() {
    const payload = { usage: usage.slice(0, 20), spending };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // 帮助诊断 dt 格式问题
  const sampleDts = usage.slice(0, 3).map(r => r.dt);

  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 mt-4">
      {/* 折叠触发器 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span>🛠</span>
          <span>{t.debugTitle}</span>
        </span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* 数据概览 */}
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-3 space-y-1.5 text-xs font-mono">
            <Row label="usage.length" value={`${usage.length} ${t.debugRecords}`} />
            <Row label={t.debugCurrentMonth} value={currentMonth} />
            <Row label={t.debugMonthRecords} value={String(monthRecordsCount)} />
            <Row label={t.debugFirstDt} value={usage[0]?.dt ?? '—'} />
            {sampleDts.length > 0 && (
              <div className="pt-1 border-t border-zinc-200 dark:border-zinc-700">
                <span className="text-zinc-400">dt samples:</span>
                {sampleDts.map((d, i) => (
                  <div key={i} className="text-zinc-600 dark:text-zinc-400 break-all">{d}</div>
                ))}
              </div>
            )}
            <div className="pt-1 border-t border-zinc-200 dark:border-zinc-700">
              <span className="text-zinc-400">{t.debugSpending}: </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {spending ? `${spending.planName} ${spending.planPrice} (${spending.totalPct}%)` : t.debugNoSpending}
              </span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400"
            >
              {copied ? t.debugCopied : t.debugCopyJson}
            </button>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="flex-1 py-1.5 text-xs border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500 disabled:opacity-40"
            >
              {t.debugClearData}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-zinc-400 shrink-0">{label}:</span>
      <span className="text-zinc-700 dark:text-zinc-300 break-all">{value}</span>
    </div>
  );
}
