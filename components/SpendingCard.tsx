import type { SpendingData } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface SpendingCardProps {
  spending: SpendingData;
  t: LocaleDict;
}

export function SpendingCard({ spending, t }: SpendingCardProps) {
  const pct = Math.min((spending.demandUsed / spending.demandLimit) * 100, 100);
  const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-brand';

  return (
    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {t.quotaUsage} · {spending.planName}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {t.resetOn} {spending.resetDate}
        </span>
      </div>

      {/* 进度条 */}
      <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>

      {/* 数字行 */}
      <div className="flex justify-between mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {t.quotaUsed}: <span className="font-medium text-zinc-700 dark:text-zinc-300">${spending.demandUsed.toFixed(2)}</span>
        </span>
        <span>
          {t.quotaLimit}: <span className="font-medium text-zinc-700 dark:text-zinc-300">${spending.demandLimit}</span>
        </span>
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}
