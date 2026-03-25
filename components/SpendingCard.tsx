import type { SpendingData } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface Props {
  spending: SpendingData;
  t: LocaleDict;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(Math.max(pct, 0), 100).toFixed(1)}%` }}
      />
    </div>
  );
}

export function SpendingCard({ spending, t }: Props) {
  return (
    <div className="px-4 py-3 space-y-4">

      {/* ── 套餐信息行 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            {spending.planName}
          </span>
          {spending.planPrice && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {spending.planPrice}
            </span>
          )}
        </div>
        {spending.resetDate && (
          <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500 ml-2">
            {t.resetOn} {spending.resetDate}
          </span>
        )}
      </div>

      {/* ── Included 总用量 ── */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Included 总用量</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-200">
            {spending.totalPct.toFixed(1)}%
          </span>
        </div>
        <Bar pct={spending.totalPct} color="bg-indigo-400 dark:bg-indigo-500" />
      </div>

      {/* ── Auto + Composer / API 2 列 ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Auto + Composer</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {spending.autoPct.toFixed(1)}%
            </span>
          </div>
          <Bar pct={spending.autoPct} color="bg-blue-400 dark:bg-blue-500" />
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            Auto / Composer 模型消耗
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>API</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {spending.apiPct.toFixed(1)}%
            </span>
          </div>
          <Bar pct={spending.apiPct} color="bg-violet-400 dark:bg-violet-500" />
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-tight">
            其他模型 API 调用消耗
          </p>
        </div>
      </div>

    </div>
  );
}
