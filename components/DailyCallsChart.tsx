import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { UsageRecord } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface Props {
  records: UsageRecord[];
  t: LocaleDict;
}

function aggregate(records: UsageRecord[]) {
  const map = new Map<string, { onDemand: number; included: number }>();
  for (const r of records) {
    const day = r.dt.slice(0, 10); // "2026-03-15"
    const entry = map.get(day) ?? { onDemand: 0, included: 0 };
    if (r.type === 'On-Demand') entry.onDemand += 1;
    else entry.included += 1;
    map.set(day, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: date.slice(5), // "03-15"
      [v.onDemand > 0 ? 'onDemand' : '_od']: v.onDemand,
      onDemand: v.onDemand,
      included: v.included,
    }));
}

export function DailyCallsChart({ records, t }: Props) {
  const data = aggregate(records);
  if (!data.length) return <p className="px-4 py-6 text-xs text-zinc-400 text-center">{t.noData}</p>;

  return (
    <div className="px-2 pb-3 pt-1">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 11 }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="onDemand" name={t.onDemand} stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
          <Bar dataKey="included" name={t.included} stackId="a" fill="#a5b4fc" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
