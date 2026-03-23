import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { UsageRecord } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface Props { records: UsageRecord[]; t: LocaleDict }

function aggregate(records: UsageRecord[]) {
  const map = new Map<string, number>();
  for (const r of records) {
    const day = r.dt.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + r.cost);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({ date: date.slice(5), cost: parseFloat(cost.toFixed(4)) }));
}

export function DailyCostChart({ records, t }: Props) {
  const data = aggregate(records);
  if (!data.length) return <p className="px-4 py-6 text-xs text-zinc-400 text-center">{t.noData}</p>;

  return (
    <div className="px-2 pb-3 pt-1">
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(v) => [`$${(v as number).toFixed(4)}`, t.costUsd]} contentStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="cost" stroke="#6366f1" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
