import { useState } from 'react';
import type { UsageRecord } from '../utils/types';
import type { LocaleDict } from '../utils/i18n/zh-CN';

interface Props { records: UsageRecord[]; t: LocaleDict }

const PAGE_SIZE = 30;

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
              <th className="px-2 py-2 text-right font-medium">{t.colCost}</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((r, i) => (
              <tr
                key={i}
                className="border-t border-zinc-50 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                <td className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  {r.dt.slice(0, 16)}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    r.type === 'On-Demand'
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                  }`}>
                    {r.type === 'On-Demand' ? t.onDemand : t.included}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-zinc-700 dark:text-zinc-300 max-w-[100px] truncate">
                  {r.model}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-300">
                  {r.cost > 0 ? `$${r.cost.toFixed(4)}` : '—'}
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
