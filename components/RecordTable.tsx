import { useState } from 'react';
import type { UsageRecord } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface Props { records: UsageRecord[]; t: LocaleDict }

const PAGE_SIZE = 30;

/** ISO / 任意日期字符串 → "MM-DD HH:mm" 本地时间格式 */
function formatDt(dt: string): string {
  try {
    const d = new Date(dt);
    if (!isNaN(d.getTime())) {
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const DD = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${MM}-${DD} ${hh}:${mm}`;
    }
  } catch { /* ignore */ }
  return dt.slice(0, 16);
}

/** Tokens 数量格式化：≥1M → "1.2M"，≥1K → "508K"，其他直接数字 */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n || 0);
}

export function RecordTable({ records, t }: Props) {
  const [page, setPage] = useState(0);
  const total = records.length;
  const start = page * PAGE_SIZE;
  const pageData = records.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (!total) return <p className="px-4 py-6 text-xs text-zinc-400 text-center">{t.noData}</p>;

  return (
    <div className="pb-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400">
              <th className="px-3 py-2 text-left font-medium">{t.colDate}</th>
              <th className="px-2 py-2 text-left font-medium">{t.colType}</th>
              <th className="px-2 py-2 text-left font-medium">{t.colModel}</th>
              <th className="px-2 py-2 text-right font-medium">{t.colTokens}</th>
              <th className="px-2 py-2 text-right font-medium">CacheR</th>
              <th className="px-2 py-2 text-right font-medium">CacheW</th>
              <th className="px-2 py-2 text-right font-medium">Input</th>
              <th className="px-2 py-2 text-right font-medium">Output</th>
              <th className="px-2 py-2 text-right font-medium">{t.colCost}</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((r, i) => (
              <tr
                key={i}
                className="border-t border-zinc-50 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                {/* 日期：本地 MM-DD HH:mm */}
                <td className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {formatDt(r.dt)}
                </td>
                {/* 类型徽章：包含 "Included" 即视为 included */}
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    r.type.includes('On-Demand')
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}>
                    {r.type.includes('On-Demand') ? t.onDemand : t.included}
                  </span>
                </td>
                {/* 模型 */}
                <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300 max-w-[90px] truncate" title={r.model}>
                  {r.model}
                </td>
                {/* Tokens 总计 */}
                <td className="px-2 py-1.5 text-right font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {formatTokens(r.tokens)}
                </td>
                {/* Token 明细（慢速采集填充，未采集显示 '-'） */}
                <td className="px-2 py-1.5 text-right font-mono text-zinc-400 dark:text-zinc-500 whitespace-nowrap text-[11px]">
                  {r.tokenBreakdown ? formatTokens(r.tokenBreakdown.cacheRead) : <span className="text-zinc-300 dark:text-zinc-600">-</span>}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-400 dark:text-zinc-500 whitespace-nowrap text-[11px]">
                  {r.tokenBreakdown ? formatTokens(r.tokenBreakdown.cacheWrite) : <span className="text-zinc-300 dark:text-zinc-600">-</span>}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-400 dark:text-zinc-500 whitespace-nowrap text-[11px]">
                  {r.tokenBreakdown ? formatTokens(r.tokenBreakdown.input) : <span className="text-zinc-300 dark:text-zinc-600">-</span>}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-400 dark:text-zinc-500 whitespace-nowrap text-[11px]">
                  {r.tokenBreakdown ? formatTokens(r.tokenBreakdown.output) : <span className="text-zinc-300 dark:text-zinc-600">-</span>}
                </td>
                {/* 费用：优先显示 cursor.com 原始字符串（如 "US$0.04"） */}
                <td className="px-2 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-300 whitespace-nowrap">
                  {r.costRaw ?? (r.cost > 0 ? `$${r.cost.toFixed(4)}` : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 pt-2 text-xs text-zinc-400">
          <span>{start + 1}–{Math.min(start + PAGE_SIZE, total)} / {total}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 disabled:opacity-30"
            >
              ‹
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
