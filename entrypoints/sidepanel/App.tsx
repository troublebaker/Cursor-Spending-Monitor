import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../utils/i18n';
import type { ThemeMode } from '../../hooks/useTheme';
import type { SupportedLang } from '../../utils/i18n';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light',  label: '☀️' },
  { value: 'dark',   label: '🌙' },
  { value: 'system', label: '💻' },
];

const LANG_OPTIONS: { value: SupportedLang; getLabel: (t: ReturnType<typeof useI18n>['t']) => string }[] = [
  { value: 'zh-CN', getLabel: (t) => t.langZh },
  { value: 'en',    getLabel: (t) => t.langEn },
];

function App() {
  const { mode, setTheme } = useTheme();
  const { t, lang, setLang } = useI18n();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-sans text-sm">

      {/* ── 顶栏 ── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
        <span className="font-semibold tracking-tight">{t.appTitle}</span>

        <div className="flex items-center gap-2">
          {/* 语言切换 */}
          <div className="flex gap-1">
            {LANG_OPTIONS.map(({ value, getLabel }) => (
              <button
                key={value}
                onClick={() => setLang(value)}
                title={`切换为 ${value}`}
                className={[
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  (lang === value || (lang === '' && value === 'zh-CN'))
                    ? 'bg-brand text-white'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
                ].join(' ')}
              >
                {getLabel(t)}
              </button>
            ))}
          </div>

          {/* 分隔线 */}
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />

          {/* 主题切换 */}
          <div className="flex gap-1">
            {THEME_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={value === 'light' ? t.themeLight : value === 'dark' ? t.themeDark : t.themeSystem}
                className={[
                  'w-7 h-7 flex items-center justify-center rounded-md transition-colors text-base',
                  mode === value
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── 内容区（F03 替换为真实仪表盘） ── */}
      <main className="flex flex-col items-center justify-center gap-3 py-12 px-4">
        <p className="text-zinc-400 dark:text-zinc-500">{t.loading}</p>

        {/* 调试面板：F03 完成后删除 */}
        <details className="w-full max-w-xs text-xs text-zinc-400 dark:text-zinc-600 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
          <summary className="cursor-pointer select-none mb-2">🔧 Debug info</summary>
          <div className="space-y-1 font-mono">
            <div>theme: <span className="text-zinc-600 dark:text-zinc-300">{mode}</span></div>
            <div>lang:  <span className="text-zinc-600 dark:text-zinc-300">{lang || 'auto'}</span></div>
            <div className="text-zinc-300 dark:text-zinc-600 mt-1">
              F12 → Application → Extension Storage → local:themeMode / local:langOverride
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}

export default App;
