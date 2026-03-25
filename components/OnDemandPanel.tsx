import type { SpendingData } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface Props {
  spending: SpendingData;
  t: LocaleDict;
}

const MODE_STYLES: Record<string, string> = {
  Fixed:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Unlimited: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Disabled:  'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400',
};

export function OnDemandPanel({ spending, t }: Props) {
  const pct = spending.demandLimit > 0
    ? Math.min((spending.demandUsed / spending.demandLimit) * 100, 100)
    : 0;

  const barColor = pct > 80
    ? 'bg-red-500'
    : pct > 50
      ? 'bg-amber-500'
      : 'bg-emerald-500 dark:bg-emerald-400';

  const mode = spending.monthlyLimitMode;
  const modeStyle = mode ? (MODE_STYLES[mode] ?? MODE_STYLES.Disabled) : '';

  return (
    <div className="px-4 py-3 space-y-4">

      {/* ── 用量进度条 ── */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{t.quotaUsed}</span>
          <span className="font-mono font-medium text-zinc-700 dark:text-zinc-200">
            ${spending.demandUsed.toFixed(2)}
            <span className="text-zinc-400 dark:text-zinc-500"> / ${spending.demandLimit}</span>
          </span>
        </div>
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct.toFixed(1)}%` }}
          />
        </div>
        <div className="text-right text-xs text-zinc-400 dark:text-zinc-500">
          {pct.toFixed(1)}%
        </div>
      </div>

      {/* ── 月用量上限 ── */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">月用量上限</span>
        <div className="flex items-center gap-1.5">
          {mode ? (
            <>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${modeStyle}`}>
                {mode}
              </span>
              {mode === 'Fixed' && spending.monthlyLimitAmount != null && (
                <span className="font-mono text-zinc-600 dark:text-zinc-300">
                  ${spending.monthlyLimitAmount}
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">—</span>
          )}
        </div>
      </div>

    </div>
  );
}
