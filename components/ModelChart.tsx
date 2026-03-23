import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import type { UsageRecord } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface Props { records: UsageRecord[]; t: LocaleDict }

const COLORS = [
  '#6366f1', '#818cf8', '#a5b4fc',
  '#34d399', '#6ee7b7',
  '#f59e0b', '#fcd34d',
  '#f87171', '#fca5a5',
  '#60a5fa', '#93c5fd', '#c4b5fd',
];

function aggregate(records: UsageRecord[]) {
  const map = new Map<string, number>();
  for (const r of records) {
    map.set(r.model, (map.get(r.model) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([model, count]) => ({
      model: model.length > 18 ? model.slice(0, 16) + '…' : model,
      count,
    }));
}

export function ModelChart({ records, t }: Props) {
  const data = aggregate(records);
  if (!data.length) return <p className="px-4 py-6 text-xs text-zinc-400 text-center">{t.noData}</p>;

  return (
    <div className="px-2 pb-3 pt-1">
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 22)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-zinc-100 dark:text-zinc-800" />
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis type="category" dataKey="model" tick={{ fontSize: 10 }} width={110} />
          <Tooltip formatter={(v) => [v as number, t.callCount]} contentStyle={{ fontSize: 11 }} />
          <Bar dataKey="count" radius={[0, 3, 3, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
