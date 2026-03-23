import { useState, useRef } from 'react';

interface CollapseSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * 可折叠区块。
 * - 懒渲染：子组件首次展开后才挂载
 * - 用 max-height 而非 display:none 隐藏：容器始终在布局中，
 *   recharts ResizeObserver 不会感知到宽度变化，不重跑入场动画
 */
export function CollapseSection({ title, defaultOpen = false, children }: CollapseSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

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

      {/* max-height 过渡：比 display:none 更安全，不打断 ResizeObserver */}
      <div
        ref={contentRef}
        style={{
          overflow: 'hidden',
          maxHeight: open ? '2000px' : '0px',
          transition: open
            ? 'max-height 0.25s ease-in'
            : 'max-height 0.2s ease-out',
        }}
      >
        {mounted && children}
      </div>
    </div>
  );
}
