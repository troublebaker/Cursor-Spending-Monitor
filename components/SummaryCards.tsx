import type { LocaleDict } from '../utils/i18n/zh-CN';

interface SummaryCardsProps {
  monthlyCost: number;
  monthlyCalls: number;
  lastUpdated: string | null;
  t: LocaleDict;
}

function timeAgo(isoStr: string): string {
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function SummaryCards({ monthlyCost, monthlyCalls, lastUpdated, t }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-0 border-b border-zinc-100 dark:border-zinc-800">
      <Card label={t.monthlyCost} value={`$${monthlyCost.toFixed(2)}`} />
      <Card label={t.monthlyCalls} value={`${monthlyCalls}${t.callCount}`} border />
      <Card
        label={t.lastUpdated}
        value={lastUpdated ? timeAgo(lastUpdated) : '—'}
        border
      />
    </div>
  );
}

function Card({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <div className={`flex flex-col items-center py-3 px-1 ${border ? 'border-l border-zinc-100 dark:border-zinc-800' : ''}`}>
      <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
        {value}
      </span>
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}
