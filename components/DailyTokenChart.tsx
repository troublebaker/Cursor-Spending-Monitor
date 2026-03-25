import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
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

/** 返回含 tokenBreakdown 的模型列表，按 token 总量降序 */
function getModels(records: UsageRecord[]): string[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.tokenBreakdown) continue;
    map.set(r.model, (map.get(r.model) ?? 0) + r.tokens);
  }
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([model]) => model);
}

function aggregate(records: UsageRecord[], model: string) {
  const map = new Map<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>();
  for (const r of records) {
    if (r.model !== model || !r.tokenBreakdown) continue;
    const day   = r.dt.slice(0, 10);
    const entry = map.get(day) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    entry.input      += r.tokenBreakdown.input;
    entry.output     += r.tokenBreakdown.output;
    entry.cacheRead  += r.tokenBreakdown.cacheRead;
    entry.cacheWrite += r.tokenBreakdown.cacheWrite;
    map.set(day, entry);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: date.slice(5),
      input:      v.input,
      output:     v.output,
      cacheRead:  v.cacheRead,
      cacheWrite: v.cacheWrite,
      total:      v.input + v.output + v.cacheRead + v.cacheWrite,
    }));
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const SERIES = [
  { key: 'input',      label: '输入',    fill: '#6366f1' },
  { key: 'output',     label: '输出',    fill: '#34d399' },
  { key: 'cacheRead',  label: '缓存读',  fill: '#f59e0b' },
  { key: 'cacheWrite', label: '缓存写',  fill: '#f87171' },
] as const;

export function DailyTokenChart({ records, t }: Props) {
  const dark   = useDark();
  const models = getModels(records);

  const [selectedModel, setSelectedModel] = useState(() => models[0] ?? '');

  useEffect(() => {
    if (models.length > 0 && !models.includes(selectedModel)) {
      setSelectedModel(models[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models.join('|')]);

  if (!models.length) {
    return (
      <p className="px-4 py-6 text-xs text-zinc-400 text-center whitespace-pre-line">
        {t.noTokenData}
      </p>
    );
  }

  const data      = aggregate(records, selectedModel);
  const totalToks = data.reduce((s, d) => s + d.total, 0);
  const tickColor = dark ? '#a1a1aa' : '#71717a';
  const gridColor = dark ? '#27272a' : '#f4f4f5';

  return (
    <div className="px-2 pb-3 pt-1">
      {/* 标题行：总量 + 模型选择器 */}
      <div className="flex items-center justify-between px-2 pb-1.5">
        <p className="text-[11px] text-zinc-400">
          {t.total}&nbsp;
          <span className="font-semibold text-zinc-600 dark:text-zinc-300">
            {totalToks.toLocaleString()} tokens
          </span>
        </p>
        <select
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          title={selectedModel}
          className="text-[10px] bg-zinc-100 dark:bg-zinc-800 border-0 rounded px-1.5 py-0.5 text-zinc-500 dark:text-zinc-400 cursor-pointer max-w-[160px]"
        >
          {models.map(m => (
            <option key={m} value={m}>
              {m.length > 28 ? m.slice(0, 26) + '…' : m}
            </option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: tickColor }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: tickColor }}
            tickFormatter={fmt}
            width={36}
          />
          <Tooltip
            formatter={(v, name) => [Number(v).toLocaleString(), name]}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          {SERIES.map(({ key, label, fill }, idx) => (
            <Bar
              key={key}
              dataKey={key}
              name={label}
              stackId="tk"
              fill={fill}
              radius={idx === SERIES.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* 数据说明 */}
      <p className="px-2 pt-1 text-[10px] text-zinc-300 dark:text-zinc-600 text-right">
        {t.tokenDataNote}
      </p>
    </div>
  );
}
