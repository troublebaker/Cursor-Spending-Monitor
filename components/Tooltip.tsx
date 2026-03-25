import { useState, useRef, useCallback } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactElement;
  /** 'bottom'（默认）：tooltip 在元素下方；'top'：在上方 */
  position?: 'top' | 'bottom';
  /** 最大宽度（px），默认 200 */
  maxWidth?: number;
  /** 传递给容器 div 的额外 className（如 flex-1） */
  className?: string;
}

/**
 * 自定义 Tooltip。
 * 鼠标进入即时显示，离开立刻隐藏，不依赖浏览器原生 title 延迟机制。
 * 自动检测视口边界，防止 tooltip 超出屏幕。
 */
export function Tooltip({ text, children, position = 'bottom', maxWidth = 200, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  // adjustX: 正数 = 往右移，负数 = 往左移（用于防止超出视口）
  const [adjustX, setAdjustX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    setVisible(true);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      // tooltip 居中时的左右边界
      const centeredLeft  = rect.left + rect.width / 2 - maxWidth / 2;
      const centeredRight = centeredLeft + maxWidth;
      const vw = window.innerWidth;
      let adj = 0;
      if (centeredLeft < 6) {
        adj = 6 - centeredLeft;                   // 左侧溢出，往右移
      } else if (centeredRight > vw - 6) {
        adj = vw - 6 - centeredRight;             // 右侧溢出，往左移
      }
      setAdjustX(adj);
    }
  }, [maxWidth]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex${className ? ` ${className}` : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={[
            'absolute z-[300] pointer-events-none',
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          ].join(' ')}
          style={{
            width: maxWidth,
            left: '50%',
            transform: `translateX(calc(-50% + ${adjustX}px))`,
          }}
        >
          <div className="bg-zinc-800 dark:bg-zinc-700 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg leading-relaxed text-center whitespace-pre-wrap">
            {text}
          </div>
          {/* 箭头：反向补偿 adjustX，始终指向触发元素中心 */}
          <div
            className={[
              'absolute w-0 h-0',
              position === 'top'
                ? 'top-full border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-zinc-800 dark:border-t-zinc-700'
                : 'bottom-full border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-zinc-800 dark:border-b-zinc-700',
            ].join(' ')}
            style={{ left: '50%', transform: `translateX(calc(-50% - ${adjustX}px))` }}
          />
        </div>
      )}
    </div>
  );
}
