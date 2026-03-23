import { useMemo } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../utils/i18n';
import type { ThemeMode } from '../../hooks/useTheme';
import type { SupportedLang } from '../../utils/i18n';
import { MOCK_USAGE, MOCK_SPENDING } from '../../utils/mockData';
import { SummaryCards } from '../../components/SummaryCards';
import { SpendingCard } from '../../components/SpendingCard';
import { CollapseSection } from '../../components/CollapseSection';
import { DailyCallsChart } from '../../components/DailyCallsChart';
import { DailyCostChart } from '../../components/DailyCostChart';
import { ModelChart } from '../../components/ModelChart';
import { RecordTable } from '../../components/RecordTable';

const THEME_OPTIONS: { value: ThemeMode; icon: string }[] = [
  { value: 'light',  icon: '☀️' },
  { value: 'dark',   icon: '🌙' },
  { value: 'system', icon: '💻' },
];

const LANG_OPTIONS: { value: SupportedLang; getLabel: (t: ReturnType<typeof useI18n>['t']) => string }[] = [
  { value: 'zh-CN', getLabel: (t) => t.langZh },
  { value: 'en',    getLabel: (t) => t.langEn },
];

function App() {
  const { mode, setTheme } = useTheme();
  const { t, lang, setLang } = useI18n();

  // F04 完成后将此处替换为 storage 数据
  const usage = MOCK_USAGE;
  const spending = MOCK_SPENDING;

  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-03"
  const monthRecords = useMemo(
    () => usage.filter((r) => r.dt.startsWith(currentMonth)),
    [usage, currentMonth],
  );

  const monthlyCost = useMemo(
    () => monthRecords.filter((r) => r.type === 'On-Demand').reduce((s, r) => s + r.cost, 0),
    [monthRecords],
  );

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-sans text-sm">

      {/* ── 顶栏 ── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900 z-10">
        <span className="font-semibold tracking-tight">{t.appTitle}</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {LANG_OPTIONS.map(({ value, getLabel }) => (
              <button
                key={value}
                onClick={() => setLang(value)}
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
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex gap-1">
            {THEME_OPTIONS.map(({ value, icon }) => (
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
                {icon}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── 摘要卡片 ── */}
      <SummaryCards
        monthlyCost={monthlyCost}
        monthlyCalls={monthRecords.length}
        lastUpdated={spending.scrapedAt}
        t={t}
      />

      {/* ── 额度进度条 ── */}
      <SpendingCard spending={spending} t={t} />

      {/* ── 每日调用次数（默认展开） ── */}
      <CollapseSection title={t.dailyCalls} defaultOpen>
        <DailyCallsChart records={monthRecords} t={t} />
      </CollapseSection>

      {/* ── 每日费用趋势（折叠，懒渲染） ── */}
      <CollapseSection title={t.dailyCost}>
        <DailyCostChart records={monthRecords} t={t} />
      </CollapseSection>

      {/* ── 模型分布 Top 12（折叠，懒渲染） ── */}
      <CollapseSection title={t.topModels}>
        <ModelChart records={monthRecords} t={t} />
      </CollapseSection>

      {/* ── 明细记录（折叠） ── */}
      <CollapseSection title={t.detailTable}>
        <RecordTable records={monthRecords} t={t} />
      </CollapseSection>

    </div>
  );
}

export default App;
