import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useState, useEffect } from 'react';
import type { UsageRecord } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface Props { records: UsageRecord[]; t: LocaleDict }

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
    const day = r.dt.slice(0, 10);
    map.set(day, (map.get(day) ?? 0) + r.cost);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost]) => ({ date: date.slice(5), cost: parseFloat(cost.toFixed(4)) }));
}

export function DailyCostChart({ records, t }: Props) {
  const dark = useDark();
  const data  = aggregate(records);
  if (!data.length) return <p className="px-4 py-6 text-xs text-zinc-400 text-center">{t.noData}</p>;

  const total = data.reduce((s, d) => s + d.cost, 0);
  const tickColor = dark ? '#a1a1aa' : '#71717a';
  const gridColor = dark ? '#27272a' : '#f4f4f5';

  return (
    <div className="px-2 pb-3 pt-1">
      {/* 总费用标注 */}
      <p className="px-2 pb-1 text-[11px] text-zinc-400 text-right">
        {t.total} <span className="font-semibold text-zinc-600 dark:text-zinc-300">${total.toFixed(4)}</span>
      </p>
      <ResponsiveContainer width="100%" height={175}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: tickColor }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: tickColor }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            formatter={(v) => [`$${(v as number).toFixed(4)}`, t.costUsd]}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#costGrad)"
            dot={false}
            activeDot={{ r: 4, fill: '#6366f1' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
