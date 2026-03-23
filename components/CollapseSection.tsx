import { useState } from 'react';

interface CollapseSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * 可折叠区块。
 * - 懒渲染：子组件首次展开后才挂载，避免隐藏图表浪费资源
 * - 折叠状态用 hidden 而非 unmount，保持图表尺寸计算正确
 */
export function CollapseSection({ title, defaultOpen = false, children }: CollapseSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(defaultOpen);

  const toggle = () => {
    if (!mounted) setMounted(true);
    setOpen((v) => !v);
  };

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors select-none"
      >
        <span>{title}</span>
        <span
          className="text-base leading-none transition-transform duration-200"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          ▾
        </span>
      </button>

      {mounted && (
        <div className={open ? 'block' : 'hidden'}>
          {children}
        </div>
      )}
    </div>
  );
}
