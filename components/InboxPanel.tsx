import { useState, useEffect, useRef } from 'react';
import type { InboxMessage } from '../utils/types';

// ── 时间格式化 ────────────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)  return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  return `${Math.floor(diff / 3600_000)}小时前`;
}

// ── 消息图标 ─────────────────────────────────────────────────────────────────

function KindIcon({ kind, isRunning }: { kind: InboxMessage['kind']; isRunning: boolean }) {
  if (kind === 'progress') {
    return isRunning
      ? <span className="inline-block w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
      : <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-300 dark:border-zinc-600 rounded-full flex-shrink-0 mt-0.5" />;
  }
  const map: Record<string, string> = {
    success: '✓',
    error:   '✗',
    info:    '·',
  };
  const color: Record<string, string> = {
    success: 'text-green-500',
    error:   'text-red-500',
    info:    'text-zinc-400',
  };
  return (
    <span className={`font-bold flex-shrink-0 w-3.5 text-center text-xs leading-none mt-0.5 ${color[kind] ?? ''}`}>
      {map[kind] ?? '·'}
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  messages:    InboxMessage[];
  isRunning:   boolean;
  onClear:     () => void;
}

// ── 组件 ──────────────────────────────────────────────────────────────────────

export function InboxPanel({ messages, isRunning, onClear }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(messages.length);
  const panelRef   = useRef<HTMLDivElement>(null);
  const listRef    = useRef<HTMLDivElement>(null);

  const unread = messages.length - lastSeenCount;

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [isOpen]);

  // 新消息到达时滚动到顶部
  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [messages.length, isOpen]);

  function handleToggle() {
    if (!isOpen) {
      setLastSeenCount(messages.length);
    }
    setIsOpen(v => !v);
  }

  return (
    <div ref={panelRef} className="relative">

      {/* ── 触发按钮 ── */}
      <button
        onClick={handleToggle}
        title="Token 详情采集信箱"
        className={[
          'relative w-7 h-7 flex items-center justify-center rounded-md text-base transition-colors',
          isOpen
            ? 'bg-brand/15 text-brand'
            : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
        ].join(' ')}
      >
        {/* 信箱 SVG */}
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="4" width="14" height="10" rx="1.5" />
          <path d="M1 6.5 8 10l7-3.5" />
          <path d="M5.5 4V2.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5V4" strokeLinecap="round" />
        </svg>
        {/* 未读红点 */}
        {unread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        {/* 采集中蓝点 */}
        {isRunning && !unread && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-brand rounded-full border-2 border-white dark:border-zinc-900 animate-pulse" />
        )}
      </button>

      {/* ── 弹出面板 ── */}
      {isOpen && (
        <div
          className={[
            'absolute right-0 top-full mt-1.5 w-72 z-50',
            'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700',
            'rounded-xl shadow-xl overflow-hidden',
            'animate-slide-down',
          ].join(' ')}
          style={{ animation: 'slideDown 0.15s ease' }}
        >

          {/* 面板头部：bot 身份 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                cs
              </div>
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">cursor-stats</span>
              <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                Token 采集
              </span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={onClear}
                className="text-[10px] text-zinc-400 hover:text-red-400 transition-colors px-1"
                title="清空消息"
              >
                清空
              </button>
            )}
          </div>

          {/* 消息列表 */}
          <div ref={listRef} className="overflow-y-auto max-h-56 divide-y divide-zinc-50 dark:divide-zinc-800/50">
            {messages.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-400">
                暂无消息，通过「更新数据+Token」按钮开始采集
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex gap-2 px-3 py-2">
                  <KindIcon kind={msg.kind} isRunning={isRunning} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug break-words">
                      {msg.text}
                    </p>
                    {msg.page !== undefined && msg.totalPages !== undefined && (
                      <div className="mt-1 h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((msg.page / msg.totalPages) * 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-zinc-400 mt-0.5">{relativeTime(msg.ts)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* 滑入动画 keyframes（注入全局一次） */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
