import { useTheme } from '../../hooks/useTheme';
import { useT } from '../../utils/i18n';
import type { ThemeMode } from '../../hooks/useTheme';

const THEME_OPTIONS: { value: ThemeMode; label: (t: ReturnType<typeof useT>) => string }[] = [
  { value: 'light',  label: (t) => t.themeLight },
  { value: 'dark',   label: (t) => t.themeDark },
  { value: 'system', label: (t) => t.themeSystem },
];

function App() {
  const { mode, setTheme } = useTheme();
  const t = useT();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* 顶栏 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <span className="text-sm font-semibold tracking-tight">{t.appTitle}</span>

        {/* 主题三态切换 */}
        <div className="flex gap-1">
          {THEME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={[
                'px-2 py-1 text-xs rounded-md transition-colors',
                mode === value
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
              ].join(' ')}
            >
              {label(t)}
            </button>
          ))}
        </div>
      </header>

      {/* 内容区（F03 替换为真实仪表盘） */}
      <main className="flex items-center justify-center h-48">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">{t.loading}</p>
      </main>
    </div>
  );
}

export default App;
