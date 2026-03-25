import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useI18n, detectBrowserLang } from '../../utils/i18n';
import type { ThemeMode } from '../../hooks/useTheme';
import type { SupportedLang } from '../../utils/i18n';
import {
  usageStorage,
  spendingStorage,
  scrapeStateStorage,
  scrapeModeStorage,
  onboardedStorage,
  noTabReminderStorage,
  inboxStorage,
  slowScrapeStateStorage,
  autoIncludeTokenStorage,
  knownAccountsStorage,
  selectedAccountStorage,
} from '../../utils/storage';
import type { UsageRecord, SpendingData, ScrapeMode, InboxMessage } from '../../utils/types';
import { SummaryCards } from '../../components/SummaryCards';
import { SpendingCard } from '../../components/SpendingCard';
import { OnDemandPanel } from '../../components/OnDemandPanel';
import { CollapseSection } from '../../components/CollapseSection';
import { DailyCallsChart } from '../../components/DailyCallsChart';
import { DailyCostChart } from '../../components/DailyCostChart';
import { DailyTokenChart } from '../../components/DailyTokenChart';
import { ModelChart } from '../../components/ModelChart';
import { RecordTable } from '../../components/RecordTable';
import { WelcomePage } from '../../components/WelcomePage';
import { StatusBar } from '../../components/StatusBar';
import { TestPanel } from '../../components/TestPanel';
import { InboxPanel } from '../../components/InboxPanel';
import { ShareMenu } from '../../components/ShareMenu';
import { Tooltip } from '../../components/Tooltip';

// ─── 常量 ────────────────────────────────────────────────────────────────────

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
  const [lastResult, setLastResult] = useState<{ ok: boolean; added: number; errorType?: string } | null>(null);
  const prevIsRunningRef  = useRef(false);
  const prevUsageLengthRef = useRef(0);

  // 测试面板开关（仅 DEV 模式可用）
  const [showTest, setShowTest] = useState(false);

  // 自动采集含 Token 设置
  const [autoIncludeToken, setAutoIncludeToken] = useState(false);

  // 反馈邮箱复制 Toast
  const [emailCopied, setEmailCopied] = useState(false);

  // InboxPanel 状态
  const [inboxMessages,    setInboxMessages]    = useState<InboxMessage[]>([]);
  const [slowScrapeRunning, setSlowScrapeRunning] = useState(false);

  // 账号管理
  const [knownAccounts, setKnownAccounts]     = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // ── 初始化 + storage watch ──────────────────────────────────────────────────
  useEffect(() => {
    // 读取初始值
    Promise.all([
      usageStorage.getValue(),
      spendingStorage.getValue(),
      onboardedStorage.getValue(),
      scrapeModeStorage.getValue(),
      scrapeStateStorage.getValue(),
      inboxStorage.getValue(),
      slowScrapeStateStorage.getValue(),
      autoIncludeTokenStorage.getValue(),
      knownAccountsStorage.getValue(),
      selectedAccountStorage.getValue(),
    ]).then(([u, s, ob, sm, ss, inbox, sss, ait, ka, sa]) => {
      setUsage(u);
      setSpending(s);
      setOnboarded(ob);
      setScrapeMode(sm);
      setIsRunning(ss.isRunning);
      setLastScrapeAt(ss.lastScrapeAt);
      setNoDataCount(ss.noDataCount);
      setLoginRequired(ss.loginRequired ?? false);
      setInboxMessages(inbox);
      setSlowScrapeRunning(sss.isRunning);
      setAutoIncludeToken(ait);
      setKnownAccounts(ka);
      setSelectedAccount(sa);

      // 侧边栏已打开：通知 background 重置指数衰减，按基准间隔重新调度
      if (sm === 'auto' || sm === 'auto_calm') {
        chrome.runtime.sendMessage({ type: 'REACTIVATE_AUTO' }).catch(() => {});
      }
    });

    // 实时监听变化
    const unwatchUsage    = usageStorage.watch(v    => setUsage(v ?? []));
    const unwatchSpending = spendingStorage.watch(v => setSpending(v ?? null));
    const unwatchInbox    = inboxStorage.watch(v    => setInboxMessages(v ?? []));
    const unwatchSlowState = slowScrapeStateStorage.watch(v => {
      if (v) setSlowScrapeRunning(v.isRunning);
    });
    const unwatchAutoToken = autoIncludeTokenStorage.watch(v => {
      if (v !== null) setAutoIncludeToken(v);
    });
    const unwatchAccounts = knownAccountsStorage.watch(v => {
      if (v) setKnownAccounts(v);
    });
    const unwatchSelectedAccount = selectedAccountStorage.watch(v => {
      if (v !== null) setSelectedAccount(v);
    });
    const unwatchState    = scrapeStateStorage.watch(v => {
      if (!v) return;
      setIsRunning(v.isRunning);
      setLastScrapeAt(v.lastScrapeAt);
      setNoDataCount(v.noDataCount);
      // storage 里的 loginRequired 变化时同步到 UI（background 写 storage，侧边栏自动响应）
      setLoginRequired(v.loginRequired ?? false);
    });

    return () => {
      unwatchUsage();
      unwatchSpending();
      unwatchInbox();
      unwatchSlowState();
      unwatchAutoToken();
      unwatchAccounts();
      unwatchSelectedAccount();
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
        // 新采集开始 → 清除上次错误结果
        if (msg.isRunning) setLastResult(null);
      }
      if (msg.type === 'SCRAPE_FAILED') {
        setIsRunning(false);
        // 直接设置错误结果，优先于 isRunning transition effect 中的成功检测
        setLastResult({ ok: false, added: 0, errorType: msg.errorType as string });
        // 10 秒后自动清除错误提示
        const id = setTimeout(() => setLastResult(null), 10_000);
        return () => clearTimeout(id);
      }
      if (msg.type === 'INBOX_MESSAGE') {
        // background 广播 inbox 消息（实时更新，storage.watch 同步持久化部分）
        setInboxMessages(prev => [msg.message as InboxMessage, ...prev].slice(0, 100));
      }
      if (msg.type === 'ACCOUNT_SWITCHED') {
        // 账号发现/切换 → 同步刷新账号列表和当前选中账号
        knownAccountsStorage.getValue().then(v => setKnownAccounts(v));
        selectedAccountStorage.getValue().then(v => setSelectedAccount(v));
      }
      if (msg.type === 'SLOW_SCRAPE_FAILED_SLOW') {
        setSlowScrapeRunning(false);
      }
      if (msg.type === 'SLOW_SCRAPE_DONE') {
        setSlowScrapeRunning(false);
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
        setLastResult(prev => {
          // SCRAPE_FAILED 消息已设置错误结果，不覆盖
          if (prev?.ok === false) return prev;
          const added = Math.max(0, usage.length - prevUsageLengthRef.current);
          prevUsageLengthRef.current = usage.length;
          return { ok: true, added };
        });
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
  // 同时按选中账号过滤（selectedAccount='' 则显示全部）
  const accountFilteredUsage = useMemo(
    () => selectedAccount ? usage.filter(r => r.accountId === selectedAccount) : usage,
    [usage, selectedAccount],
  );
  const accountFilteredMonth = useMemo(
    () => accountFilteredUsage.filter(r => {
      if (r.dt.startsWith(currentMonth)) return true;
      const d = new Date(r.dt);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === new Date().getFullYear()
        && d.getMonth() === new Date().getMonth();
    }),
    [accountFilteredUsage, currentMonth],
  );
  const displayRecords = accountFilteredMonth.length > 0 ? accountFilteredMonth : accountFilteredUsage;

  const monthlyCost = useMemo(
    () => monthRecords.filter(r => r.type.toLowerCase().includes('on-demand')).reduce((s, r) => s + r.cost, 0),
    [monthRecords],
  );

  // ── CSV 导出 ────────────────────────────────────────────────────────────────
  function exportCsv() {
    const headers = ['Date', 'Type', 'Model', 'Tokens', 'Cost', 'Input Tokens', 'Output Tokens', 'Cache Read', 'Cache Write'];
    const rows = displayRecords.map(r => [
      r.dt,
      r.type,
      r.model,
      r.tokens,
      r.costRaw ?? (r.cost > 0 ? r.cost.toFixed(6) : ''),
      r.tokenBreakdown?.input   ?? '',
      r.tokenBreakdown?.output  ?? '',
      r.tokenBreakdown?.cacheRead  ?? '',
      r.tokenBreakdown?.cacheWrite ?? '',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cursor-spending-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── 操作处理 ────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    await onboardedStorage.setValue(true);
    await scrapeModeStorage.setValue('manual');
    setOnboarded(true);
    setScrapeMode('manual');
    // 不自动触发采集；首次引导后默认手动，用户自行点击「更新数据」
  };

  const handleModeChange = async (newMode: ScrapeMode) => {
    setScrapeMode(newMode);
    await scrapeModeStorage.setValue(newMode);
    // background 通过 watch scrapeModeStorage 自动重新调度 alarm
  };

  const handleScrapeNow = () => {
    chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE' }).catch(() => {});
  };

  const handleScrapeWithToken = () => {
    chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE_WITH_TOKEN' }).catch(() => {});
  };

  const handleAbort = () => {
    if (isRunning) {
      chrome.runtime.sendMessage({ type: 'CANCEL_SCRAPE' }).catch(() => {});
    }
    if (slowScrapeRunning) {
      chrome.runtime.sendMessage({ type: 'SLOW_SCRAPE_CANCEL' }).catch(() => {});
    }
  };

  const handleAutoIncludeTokenChange = async (v: boolean) => {
    setAutoIncludeToken(v);
    await autoIncludeTokenStorage.setValue(v);
  };

  const handleClearData = async () => {
    if (selectedAccount) {
      // 只删除当前选中账号的记录，保留其他账号数据
      const all = await usageStorage.getValue();
      const remaining = all.filter(r => r.accountId !== selectedAccount);
      await usageStorage.setValue(remaining);
      setUsage(remaining);
      // 从已知账号列表中移除该账号
      const updatedAccounts = knownAccounts.filter(a => a !== selectedAccount);
      await knownAccountsStorage.setValue(updatedAccounts);
      setKnownAccounts(updatedAccounts);
      // 重置账号选择
      await selectedAccountStorage.setValue('');
      setSelectedAccount('');
    } else {
      // 无选中账号 = 清空全部
      await usageStorage.setValue([]);
      await spendingStorage.setValue(null);
      await knownAccountsStorage.setValue([]);
      setUsage([]);
      setSpending(null);
      setKnownAccounts([]);
    }
    setLastResult(null);
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
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD_TAB' }).catch(() => {
      // background 未响应时降级：直接打开 usage URL（未登录会跳 auth，登后跳回触发 content script）
      chrome.tabs.create({ url: 'https://cursor.com/cn/dashboard/usage', active: true });
    });
  };

  const handleOpenTest = async () => {
    // 进入测试模式前先切换为手动，暂停 alarm 驱动的自动采集
    await handleModeChange('manual');
    setShowTest(true);
  };

  const handleCloseTest = () => {
    setShowTest(false);
  };

  const handleSlowScrapeStart = () => {
    chrome.runtime.sendMessage({ type: 'SLOW_SCRAPE_START' }).catch(() => {});
  };

  const handleSlowScrapeCancel = () => {
    chrome.runtime.sendMessage({ type: 'SLOW_SCRAPE_CANCEL' }).catch(() => {});
  };

  const handleInboxClear = async () => {
    await inboxStorage.setValue([]);
    setInboxMessages([]);
  };

  const handleAccountChange = async (account: string) => {
    setSelectedAccount(account);
    await selectedAccountStorage.setValue(account);
  };

  const handleCopyEmail = async () => {
    await navigator.clipboard.writeText('codejames971@gmail.com');
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2200);
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

      {/* ── 测试面板（全屏覆盖，顶栏不显示） ── */}
      {import.meta.env.DEV && showTest && (
        <TestPanel
          usage={usage}
          spending={spending}
          status={{ isRunning, lastScrapeAt, noDataCount, loginRequired, scrapeMode }}
          onClose={handleCloseTest}
        />
      )}

      {/* ── 以下内容在测试面板打开时隐藏 ── */}
      {!(import.meta.env.DEV && showTest) && (<>

      {/* ── 顶栏 ── */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900 z-10 gap-2">
        {/* 左侧：账号选择器 */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          {knownAccounts.length > 0 && (
            <Tooltip text={t.accountTooltip} position="bottom" maxWidth={210}>
              <select
                value={selectedAccount}
                onChange={e => handleAccountChange(e.target.value)}
                className="text-[10px] bg-zinc-100 dark:bg-zinc-800 border-0 rounded-md px-1.5 py-0.5 text-zinc-500 dark:text-zinc-400 cursor-pointer max-w-[100px] truncate"
              >
                <option value="">{t.accountAll}</option>
                {knownAccounts.map(a => (
                  <option key={a} value={a} title={a}>
                    {a.length > 16 ? a.slice(0, 14) + '…' : a}
                  </option>
                ))}
              </select>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">

          {/* ── 社交按钮组（最醒目位置：最左侧） ── */}
          <div className="flex items-center gap-1">
            <ShareMenu />
            <Tooltip text={t.followTooltip} position="bottom" maxWidth={160}>
              <button
                onClick={() => chrome.tabs.create({ url: 'https://x.com/intent/follow?screen_name=CodeJames333025', active: true })}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
              >
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M12.6 1h2.4L9.7 7l6.1 8H11L7.3 9.7 3.1 15H.7l5.7-6.5L.3 1h5.2L8.7 5.8zM11.8 13.5h1.3L4.3 2.4H2.9z"/>
                </svg>
              </button>
            </Tooltip>
            <Tooltip text={t.feedbackTooltip} position="bottom" maxWidth={185}>
              <button
                onClick={handleCopyEmail}
                className={[
                  'w-7 h-7 flex items-center justify-center rounded-md transition-colors',
                  emailCopied
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-500'
                    : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400',
                ].join(' ')}
              >
                {emailCopied ? (
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 8l4 4 8-8" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="4" width="14" height="10" rx="1.5" />
                    <path d="M1 6.5 8 10l7-3.5" />
                  </svg>
                )}
              </button>
            </Tooltip>
          </div>

          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />

          {/* ── 语言下拉 ── */}
          <Tooltip text={t.langTooltip} position="bottom" maxWidth={150}>
            <select
              value={lang || detectBrowserLang()}
              onChange={e => setLang(e.target.value as SupportedLang)}
              className="text-xs bg-zinc-100 dark:bg-zinc-800 border-0 rounded-md px-1.5 py-1 text-zinc-600 dark:text-zinc-300 cursor-pointer"
            >
              <option value="zh-CN">中文</option>
              <option value="en">EN</option>
            </select>
          </Tooltip>

          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />

          {/* ── 信箱 ── */}
          <InboxPanel
            messages={inboxMessages}
            isRunning={slowScrapeRunning}
            onClear={handleInboxClear}
          />

          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />

          {/* ── 主题下拉 ── */}
          <Tooltip text={t.themeTooltip} position="bottom" maxWidth={140}>
            <select
              value={mode}
              onChange={e => setTheme(e.target.value as ThemeMode)}
              className="text-xs bg-zinc-100 dark:bg-zinc-800 border-0 rounded-md px-1.5 py-1 text-zinc-600 dark:text-zinc-300 cursor-pointer"
            >
              <option value="light">☀️ {t.themeLight}</option>
              <option value="dark">🌙 {t.themeDark}</option>
              <option value="system">💻 {t.themeSystem}</option>
            </select>
          </Tooltip>

          {/* ── DEV 测试面板入口 ── */}
          {import.meta.env.DEV && (
            <>
              <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />
              <Tooltip text="测试面板（自动暂停采集）" position="bottom">
                <button
                  onClick={handleOpenTest}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-base bg-zinc-100 hover:bg-amber-100 dark:bg-zinc-800 dark:hover:bg-amber-900/40 transition-colors"
                >
                  ⚗️
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </header>

      {/* ── 状态栏 ── */}
      <StatusBar
        t={t}
        isRunning={isRunning}
        slowScrapeRunning={slowScrapeRunning}
        loginRequired={loginRequired}
        lastScrapeAt={lastScrapeAt}
        scrapeMode={scrapeMode}
        noDataCount={noDataCount}
        lastResult={lastResult}
        autoIncludeToken={autoIncludeToken}
        onModeChange={handleModeChange}
        onScrapeNow={handleScrapeNow}
        onScrapeWithToken={handleScrapeWithToken}
        onAbort={handleAbort}
        onClearData={handleClearData}
        onAutoIncludeTokenChange={handleAutoIncludeTokenChange}
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

      {/* ── Section 1：套餐 & 配额（有 spending 数据才显示） ── */}
      {spending && (
        <CollapseSection title={t.sectionPlan} defaultOpen>
          <SpendingCard spending={spending} t={t} />
        </CollapseSection>
      )}

      {/* ── Section 2：按需 & 月限（有 spending 数据才显示） ── */}
      {spending && (
        <CollapseSection title={t.sectionDemand} defaultOpen>
          <OnDemandPanel spending={spending} t={t} />
        </CollapseSection>
      )}

      {/* ── 数据为空时提示 ── */}
      {usage.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 text-sm gap-2">
          <span className="text-3xl">🕐</span>
          <span>{t.statusCollecting}</span>
        </div>
      )}

      {/* ── 图表区（有数据才渲染，默认展开，用户折叠状态自动持久化） ── */}
      {usage.length > 0 && (
        <>
          <CollapseSection id="sec-daily-calls" title={t.dailyCalls} defaultOpen>
            <DailyCallsChart records={displayRecords} t={t} />
          </CollapseSection>
          <CollapseSection id="sec-daily-cost" title={t.dailyCost} defaultOpen>
            <DailyCostChart records={displayRecords} t={t} />
          </CollapseSection>
          <CollapseSection id="sec-models" title={t.topModels} defaultOpen>
            <ModelChart records={displayRecords} t={t} />
          </CollapseSection>
          <CollapseSection id="sec-tokens" title={t.dailyTokens} defaultOpen>
            <DailyTokenChart records={displayRecords} t={t} />
          </CollapseSection>
        </>
      )}

      {/* ── 明细记录（最下方，默认折叠，持久化状态） ── */}
      {usage.length > 0 && (
        <CollapseSection
          id="sec-records"
          title={t.detailTable}
          extra={
            displayRecords.length > 0 ? (
              <button
                onClick={exportCsv}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition-colors"
              >
                <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v9M4 8l4 4 4-4" />
                  <path d="M2 13h12" />
                </svg>
                {t.exportCsv}
              </button>
            ) : undefined
          }
        >
          <RecordTable records={displayRecords} t={t} />
        </CollapseSection>
      )}

      </>)}

      {/* 邮箱复制 Toast */}
      {emailCopied && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[400] px-4 py-2 bg-zinc-800 dark:bg-zinc-700 text-white text-xs rounded-xl shadow-lg pointer-events-none">
          {t.emailCopied}
        </div>
      )}

      </>)}  {/* end !showTest */}

    </div>
  );
}

export default App;
