import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../utils/i18n';

const GITHUB_URL = 'https://github.com/troublebaker/Cursor-Spending-Monitor';

export function ShareMenu() {
  const { t } = useI18n();
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const SHARE_TEXT = t.shareText;

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function openTab(url: string) {
    chrome.tabs.create({ url, active: true });
    setOpen(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(GITHUB_URL);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1800);
  }

  const items = [
    {
      icon: (
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
      ),
      label: t.shareGitHub,
      onClick: () => openTab(GITHUB_URL),
    },
    {
      icon: <span className="text-sm font-black leading-none">𝕏</span>,
      label: t.shareX,
      onClick: () => openTab(
        `https://x.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(GITHUB_URL)}&via=CodeJames333025`
      ),
    },
    {
      icon: <span className="text-base leading-none">🔴</span>,
      label: t.shareReddit,
      onClick: () => openTab(
        `https://www.reddit.com/submit?url=${encodeURIComponent(GITHUB_URL)}&title=${encodeURIComponent(SHARE_TEXT)}`
      ),
    },
    {
      icon: copied
        ? <span className="text-green-400 font-bold text-sm leading-none">✓</span>
        : <span className="text-sm leading-none">🔗</span>,
      label: copied ? t.shareCopied : t.shareCopy,
      onClick: copyLink,
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title={t.shareMenuTitle}
        className={[
          'w-7 h-7 flex items-center justify-center rounded-md transition-colors',
          open
            ? 'bg-brand/15 text-brand'
            : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400',
        ].join(' ')}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12.5" cy="3" r="1.5" />
          <circle cx="12.5" cy="13" r="1.5" />
          <circle cx="3.5" cy="8" r="1.5" />
          <path d="M5 7.3 11 3.8M5 8.7l6 3.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-52 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden"
          style={{ animation: 'slideDown 0.15s ease' }}
        >
          <p className="px-3.5 pt-2.5 pb-1.5 text-[10px] uppercase tracking-wide text-zinc-400 font-semibold select-none">
            {t.shareMenuTitle}
          </p>
          {items.map(({ icon, label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <span className="w-4 flex items-center justify-center flex-shrink-0">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}
