import { useState, useRef, useEffect } from 'react';

const STORE_KEY = 'sectionOpenStates';

async function readSectionStates(): Promise<Record<string, boolean>> {
  const r = await chrome.storage.local.get(STORE_KEY);
  return (r[STORE_KEY] ?? {}) as Record<string, boolean>;
}

async function writeSectionState(id: string, open: boolean): Promise<void> {
  const states = await readSectionStates();
  await chrome.storage.local.set({ [STORE_KEY]: { ...states, [id]: open } });
}

interface CollapseSectionProps {
  title: string;
  /**
   * 持久化 key。提供后，用户折叠/展开状态会写入 chrome.storage.local，
   * 下次打开插件自动还原。
   */
  id?: string;
  defaultOpen?: boolean;
  /** 渲染在标题行右侧、箭头左侧的额外内容（如导出按钮），点击不触发折叠 */
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 可折叠区块。
 * - 懒渲染：子组件首次展开后才挂载
 * - 用 max-height 而非 display:none 隐藏：容器始终在布局中，
 *   recharts ResizeObserver 不会感知到宽度变化，不重跑入场动画
 * - 提供 id 时自动持久化展开/折叠状态
 */
export function CollapseSection({ title, id, defaultOpen = false, extra, children }: CollapseSectionProps) {
  const [open, setOpen]       = useState(defaultOpen);
  const [mounted, setMounted] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  // 从 storage 还原状态（仅在有 id 时执行，异步不阻塞首渲染）
  useEffect(() => {
    if (!id) return;
    readSectionStates().then(states => {
      if (id in states) {
        const v = states[id];
        setOpen(v);
        if (v) setMounted(true);
      }
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const next = !open;
    if (next && !mounted) setMounted(true);
    setOpen(next);
    if (id) writeSectionState(id, next);
  };

  return (
    <div className="border-b border-zinc-100 dark:border-zinc-800">
      <div className="flex items-center">
        <button
          onClick={toggle}
          className="flex-1 flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors select-none text-left"
        >
          <span>{title}</span>
          <span
            className="text-base leading-none transition-transform duration-200"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            ▾
          </span>
        </button>
        {extra && (
          <div className="px-2 shrink-0" onClick={e => e.stopPropagation()}>
            {extra}
          </div>
        )}
      </div>

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
