import { useState, useEffect, useRef } from 'react';
import type { InboxMessage } from '../utils/types';
import { useI18n } from '../utils/i18n';
import type { LocaleDict } from '../utils/i18n';

// ── 版本信息 Modal ────────────────────────────────────────────────────────────

function VersionModal({ t, onClose }: { t: LocaleDict; onClose: () => void }) {
  const version = chrome.runtime.getManifest().version;

  function openGitHub() {
    chrome.tabs.create({ url: 'https://github.com/troublebaker/Cursor-Spending-Monitor', active: true });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 w-72 mx-4 border border-zinc-200 dark:border-zinc-700"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors text-sm"
        >
          ✕
        </button>

        {/* 标题行 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0 select-none">
            cs
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Cursor Spending Monitor</p>
            <p className="text-xs text-zinc-400">v{version}</p>
          </div>
        </div>

        {/* 描述 */}
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
          {t.aboutDesc}
        </p>

        {/* 元数据 */}
        <div className="space-y-1.5 text-xs mb-4">
          {[
            ['License', 'MIT'],
            ['Author',  'troublebaker'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-zinc-400">
              <span>{k}</span><span className="text-zinc-500 dark:text-zinc-300">{v}</span>
            </div>
          ))}
        </div>

        {/* GitHub 按钮 */}
        <button
          onClick={openGitHub}
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 transition-colors"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          {t.aboutGitHub}
        </button>
      </div>
    </div>
  );
}

// ── 时间格式化 ────────────────────────────────────────────────────────────────

function relativeTime(ts: string, t: LocaleDict): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)   return t.justNow;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} ${t.minutesAgo}`;
  return `${Math.floor(diff / 3600_000)} ${t.hoursAgo}`;
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
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
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
        title={t.inboxSubtitle}
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
            'absolute right-0 top-full mt-1.5 w-[374px] z-50',
            'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700',
            'rounded-xl shadow-xl overflow-hidden',
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
                {t.inboxSubtitle}
              </span>
            </div>
            {messages.length > 0 && (
              <button
                onClick={onClear}
                className="text-[10px] text-zinc-400 hover:text-red-400 transition-colors px-1"
              >
                {t.inboxClear}
              </button>
            )}
          </div>

          {/* 置顶：版本信息入口 */}
          <button
            onClick={() => setShowVersion(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
          >
            <span className="text-xs">📋</span>
            <span className="flex-1 text-[11px] text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
              {t.aboutTitle}
            </span>
            <span className="text-[10px] text-zinc-400">v{chrome.runtime.getManifest().version} ›</span>
          </button>

          {/* 消息列表 */}
          <div ref={listRef} className="overflow-y-auto divide-y divide-zinc-50 dark:divide-zinc-800/50" style={{ maxHeight: 336 }}>
            {messages.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-400">
                {t.inboxEmpty}
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
                    <p className="text-[10px] text-zinc-400 mt-0.5">{relativeTime(msg.ts, t)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* 版本信息浮窗 */}
      {showVersion && <VersionModal t={t} onClose={() => setShowVersion(false)} />}

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
