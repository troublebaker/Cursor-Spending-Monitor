import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../utils/i18n';
import type { ThemeMode } from '../../hooks/useTheme';
import type { SupportedLang } from '../../utils/i18n';
import {
  usageStorage,
  spendingStorage,
  scrapeStateStorage,
  scrapeModeStorage,
  onboardedStorage,
  noTabReminderStorage,
} from '../../utils/storage';
import type { UsageRecord, SpendingData, ScrapeMode } from '../../utils/types';
import { SummaryCards } from '../../components/SummaryCards';
import { SpendingCard } from '../../components/SpendingCard';
import { CollapseSection } from '../../components/CollapseSection';
import { DailyCallsChart } from '../../components/DailyCallsChart';
import { DailyCostChart } from '../../components/DailyCostChart';
import { ModelChart } from '../../components/ModelChart';
import { RecordTable } from '../../components/RecordTable';
import { WelcomePage } from '../../components/WelcomePage';
import { StatusBar } from '../../components/StatusBar';
import { DebugPanel } from '../../components/DebugPanel';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const THEME_OPTIONS: { value: ThemeMode; icon: string }[] = [
  { value: 'light',  icon: '☀️' },
  { value: 'dark',   icon: '🌙' },
  { value: 'system', icon: '💻' },
];

const LANG_OPTIONS: { value: SupportedLang; getLabel: (t: ReturnType<typeof useI18n>['t']) => string }[] = [
  { value: 'zh-CN', getLabel: (t) => t.langZh },
  { value: 'en',    getLabel: (t) => t.langEn },
];

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const { mode, setTheme } = useTheme();
  const { t, lang, setLang } = useI18n();

  // 真实数据（从 storage 读取）
  const [usage, setUsage]       = useState<UsageRecord[]>([]);
  const [spending, setSpending] = useState<SpendingData | null>(null);

  // 采集状态
  const [onboarded,   setOnboarded]   = useState<boolean | null>(null); // null = 初次加载中
  const [scrapeMode,  setScrapeMode]  = useState<ScrapeMode>('auto');
  const [isRunning,   setIsRunning]   = useState(false);
  const [lastScrapeAt, setLastScrapeAt] = useState<string | null>(null);
  const [noDataCount, setNoDataCount] = useState(0);

  // UI 通知状态
  const [tabClosed,      setTabClosed]      = useState(false);
  const [loginRequired,  setLoginRequired]  = useState(false);
  // 采集结果（5 秒后自动清除）
  const [lastResult, setLastResult] = useState<{ ok: boolean; added: number } | null>(null);
  const prevIsRunningRef  = useRef(false);
  const prevUsageLengthRef = useRef(0);

  // ── 初始化 + storage watch ──────────────────────────────────────────────────
  useEffect(() => {
    // 读取初始值
    Promise.all([
      usageStorage.getValue(),
      spendingStorage.getValue(),
      onboardedStorage.getValue(),
      scrapeModeStorage.getValue(),
      scrapeStateStorage.getValue(),
    ]).then(([u, s, ob, sm, ss]) => {
      setUsage(u);
      setSpending(s);
      setOnboarded(ob);
      setScrapeMode(sm);
      setIsRunning(ss.isRunning);
      setLastScrapeAt(ss.lastScrapeAt);
      setNoDataCount(ss.noDataCount);

      // 侧边栏打开时自动触发一次采集（已引导 + 当前未在采集中）
      if (ob && !ss.isRunning) {
        chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE' }).catch(() => {});
      }
    });

    // 实时监听变化
    const unwatchUsage    = usageStorage.watch(v    => setUsage(v ?? []));
    const unwatchSpending = spendingStorage.watch(v => setSpending(v ?? null));
    const unwatchState    = scrapeStateStorage.watch(v => {
      if (!v) return;
      setIsRunning(v.isRunning);
      setLastScrapeAt(v.lastScrapeAt);
      setNoDataCount(v.noDataCount);
    });

    return () => {
      unwatchUsage();
      unwatchSpending();
      unwatchState();
    };
  }, []);

  // ── background 消息监听 ─────────────────────────────────────────────────────
  useEffect(() => {
    const listener = (msg: { type: string; [k: string]: unknown }) => {
      if (msg.type === 'TAB_CLOSED')      setTabClosed(true);
      if (msg.type === 'LOGIN_REQUIRED')  setLoginRequired(true);
      if (msg.type === 'LOGIN_RESTORED')  setLoginRequired(false);
      if (msg.type === 'SCRAPE_STATUS') {
        setIsRunning(msg.isRunning as boolean);
        setLastScrapeAt(msg.lastScrapeAt as string | null);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // ── 采集完成检测（isRunning true→false 时计算新增条数） ──────────────────────
  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    prevIsRunningRef.current = isRunning;

    if (wasRunning && !isRunning) {
      // 稍等 500ms 让 usageStorage.watch 更新 usage 后再对比
      const id = setTimeout(() => {
        const added = Math.max(0, usage.length - prevUsageLengthRef.current);
        setLastResult({ ok: true, added });
        prevUsageLengthRef.current = usage.length;
        const dismissId = setTimeout(() => setLastResult(null), 5000);
        return () => clearTimeout(dismissId);
      }, 500);
      return () => clearTimeout(id);
    }
    if (!isRunning) {
      prevUsageLengthRef.current = usage.length;
    }
  // isRunning 变化时执行，usage.length 在 timeout 内读取
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // ── 月度计算 ────────────────────────────────────────────────────────────────
  // currentMonth 使用本地时间（避免时区边界误差）
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const monthRecords = useMemo(
    () => usage.filter(r => {
      // 快速路径：ISO 格式 "2026-03-..."
      if (r.dt.startsWith(currentMonth)) return true;
      // 降级路径：解析后再比较月份（兼容 cursor.com 其他日期文本格式）
      const d = new Date(r.dt);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === new Date().getFullYear()
        && d.getMonth() === new Date().getMonth();
    }),
    [usage, currentMonth],
  );

  // 图表数据：优先用当月，若当月为空则显示全部记录（帮助调试）
  const displayRecords = monthRecords.length > 0 ? monthRecords : usage;

  const monthlyCost = useMemo(
    () => monthRecords.filter(r => r.type.toLowerCase().includes('on-demand')).reduce((s, r) => s + r.cost, 0),
    [monthRecords],
  );

  // ── 操作处理 ────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    await onboardedStorage.setValue(true);
    await scrapeModeStorage.setValue('auto');
    setOnboarded(true);
    setScrapeMode('auto');
    chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE' }).catch(() => {});
  };

  const handleModeChange = async (newMode: ScrapeMode) => {
    setScrapeMode(newMode);
    await scrapeModeStorage.setValue(newMode);
    // background 通过 watch scrapeModeStorage 自动重新调度 alarm
  };

  const handleScrapeNow = () => {
    chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE' }).catch(() => {});
  };

  const handleReopenTab = () => {
    setTabClosed(false);
    chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE' }).catch(() => {});
  };

  const handleNoRemind = async () => {
    await noTabReminderStorage.setValue(true);
    setTabClosed(false);
  };

  const handleOpenLogin = () => {
    chrome.tabs.create({ url: 'https://cursor.com/login', active: true });
  };

  // ── 渲染 ────────────────────────────────────────────────────────────────────

  // 初次加载中
  if (onboarded === null) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-400 text-sm">
        {t.loading}
      </div>
    );
  }

  // 未引导 → 欢迎页（含语言选择器）
  if (!onboarded) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-900">
        <WelcomePage t={t} lang={lang} onLangChange={setLang} onStart={handleStart} />
      </div>
    );
  }

  // 主仪表盘
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

      {/* ── 状态栏 ── */}
      <StatusBar
        t={t}
        isRunning={isRunning}
        loginRequired={loginRequired}
        lastScrapeAt={lastScrapeAt}
        scrapeMode={scrapeMode}
        noDataCount={noDataCount}
        lastResult={lastResult}
        onModeChange={handleModeChange}
        onScrapeNow={handleScrapeNow}
      />

      {/* ── Tab 关闭提醒 ── */}
      {tabClosed && (
        <div className="mx-3 mt-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="font-medium text-amber-800 dark:text-amber-300 text-xs">{t.tabClosedBanner}</p>
          <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5 mb-2">{t.tabClosedDesc}</p>
          <div className="flex gap-2">
            <button
              onClick={handleReopenTab}
              className="px-3 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              {t.tabClosedReopen}
            </button>
            <button
              onClick={handleNoRemind}
              className="px-3 py-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
            >
              {t.tabClosedNoRemind}
            </button>
          </div>
        </div>
      )}

      {/* ── 未登录：全屏大提示（遮盖内容区，保留顶栏） ── */}
      {loginRequired && (
        <div className="flex flex-col items-center justify-center px-6 py-12 min-h-[calc(100vh-48px)]">
          <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-6 text-4xl">
            🔐
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 text-center">
            {t.loginRequired}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-8 leading-relaxed max-w-xs">
            {t.loginRequiredDesc}
          </p>
          <button
            onClick={handleOpenLogin}
            className="w-full max-w-xs py-3.5 bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl transition-colors text-sm shadow-sm mb-4"
          >
            {t.loginOpen}
          </button>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center">
            {t.loginNote}
          </p>
        </div>
      )}

      {/* ── 以下内容仅在已登录时渲染 ── */}
      {!loginRequired && (<>

      {/* ── 摘要卡片 ── */}
      <SummaryCards
        monthlyCost={monthlyCost}
        monthlyCalls={monthRecords.length}
        lastUpdated={spending?.scrapedAt ?? null}
        t={t}
      />

      {/* ── 额度进度条（有 spending 数据才显示） ── */}
      {spending && <SpendingCard spending={spending} t={t} />}

      {/* ── 数据为空时提示 ── */}
      {usage.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 text-sm gap-2">
          <span className="text-3xl">🕐</span>
          <span>{t.statusCollecting}</span>
        </div>
      )}

      {/* ── 图表区（有数据才渲染） ── */}
      {usage.length > 0 && (
        <>
          <CollapseSection title={t.dailyCalls} defaultOpen>
            <DailyCallsChart records={displayRecords} t={t} />
          </CollapseSection>
          <CollapseSection title={t.dailyCost}>
            <DailyCostChart records={displayRecords} t={t} />
          </CollapseSection>
          <CollapseSection title={t.topModels}>
            <ModelChart records={displayRecords} t={t} />
          </CollapseSection>
          <CollapseSection title={t.detailTable}>
            <RecordTable records={displayRecords} t={t} />
          </CollapseSection>
        </>
      )}

      </>)}

      {/* ── 调试面板（始终可见，默认折叠） ── */}
      <DebugPanel
        t={t}
        usage={usage}
        spending={spending}
        currentMonth={currentMonth}
        monthRecordsCount={monthRecords.length}
        onDataCleared={() => {
          setUsage([]);
          setSpending(null);
        }}
      />

    </div>
  );
}

export default App;
