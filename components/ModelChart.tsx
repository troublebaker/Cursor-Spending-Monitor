import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { useState, useEffect } from 'react';
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

function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function aggregate(records: UsageRecord[]) {
  const map = new Map<string, number>();
  for (const r of records) {
    map.set(r.model, (map.get(r.model) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([model, count]) => ({
      model: model.length > 20 ? model.slice(0, 18) + '…' : model,
      count,
    }));
}

export function ModelChart({ records, t }: Props) {
  const dark = useDark();
  const data  = aggregate(records);
  if (!data.length) return <p className="px-4 py-6 text-xs text-zinc-400 text-center">{t.noData}</p>;

  const tickColor  = dark ? '#a1a1aa' : '#71717a';
  const gridColor  = dark ? '#27272a' : '#f4f4f5';
  const labelColor = dark ? '#e4e4e7' : '#3f3f46';

  return (
    <div className="px-2 pb-3 pt-1">
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 26)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 36, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: tickColor }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="model"
            tick={{ fontSize: 10, fill: tickColor }}
            width={116}
          />
          <Tooltip
            formatter={(v) => [v as number, t.callCount]}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="count"
              position="right"
              style={{ fontSize: 10, fill: labelColor }}
            />
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
