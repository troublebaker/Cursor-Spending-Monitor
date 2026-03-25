import { useState, useEffect } from 'react';
import type { UsageRecord, SpendingData, ScrapeMode } from '../utils/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatusInfo {
  isRunning: boolean;
  lastScrapeAt: string | null;
  noDataCount: number;
  loginRequired: boolean;
  scrapeMode: ScrapeMode;
}

interface Props {
  usage: UsageRecord[];
  spending: SpendingData | null;
  status: StatusInfo;
  onClose: () => void;
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export function TestPanel({ usage, spending, status, onClose }: Props) {
  const interval = Math.min(Math.pow(2, status.noDataCount), 60);

  // Token 详情 hover 测试结果
  const [hoverState, setHoverState] = useState<'idle' | 'running' | 'done'>('idle');
  const [hoverResult, setHoverResult] = useState<{
    html: string | null;
    triggerText: string;
    parsed: Record<string, number> | null;
    portalCount: number;
    error?: string;
  } | null>(null);

  // 用户信息测试结果
  const [userInfoState, setUserInfoState] = useState<'idle' | 'running' | 'done'>('idle');
  const [userInfoResult, setUserInfoResult] = useState<{
    name: string; plan: string; error?: string;
  } | null>(null);

  // Spending 页面测试结果
  type RunState = 'idle' | 'running' | 'done';
  const [planState,     setPlanState]     = useState<RunState>('idle');
  const [planResult,    setPlanResult]    = useState<{ plan: string; price: string; resetText: string; error?: string } | null>(null);
  const [usageState,    setUsageState]    = useState<RunState>('idle');
  const [usageResult,   setUsageResult]   = useState<{ total: string; summary: string; auto: string; api: string; error?: string } | null>(null);
  const [onDemandState, setOnDemandState] = useState<RunState>('idle');
  const [onDemandResult, setOnDemandResult] = useState<{ displayText: string; usedDollars: number; limitDollars: number; mode: string; amount: number | null; error?: string } | null>(null);

  // 中断模拟测试
  type InterruptScenario = 'logout' | 'network' | 'id_mismatch';
  const [interruptScenario, setInterruptScenario] = useState<InterruptScenario>('logout');
  const [interruptState,    setInterruptState]    = useState<RunState>('idle');
  const [interruptResult,   setInterruptResult]   = useState<{
    scenario:      string;
    dataCollected: number;
    interrupted:   boolean;
    reason:        string;
    checks:        Record<string, unknown>;
    error?:        string;
  } | null>(null);

  // 监听 background 广播
  useEffect(() => {
    const handler = (msg: { type: string; [k: string]: unknown }) => {
      if (msg.type === 'TOKEN_HOVER_RESULT') {
        setHoverResult({
          html:        (msg.html as string | null),
          triggerText: (msg.triggerText as string) ?? '',
          parsed:      (msg.parsed as Record<string, number> | null) ?? null,
          portalCount: (msg.portalCount as number) ?? 0,
          error:       (msg.error as string | undefined),
        });
        setHoverState('done');
      }
      if (msg.type === 'USER_INFO_RESULT') {
        setUserInfoResult({
          name:  (msg.name as string) ?? '',
          plan:  (msg.plan as string) ?? '',
          error: (msg.error as string | undefined),
        });
        setUserInfoState('done');
      }
      if (msg.type === 'SPENDING_PLAN_RESULT') {
        setPlanResult({
          plan: (msg.plan as string) ?? '',
          price: (msg.price as string) ?? '',
          resetText: (msg.resetText as string) ?? '',
          error: (msg.error as string | undefined),
        });
        setPlanState('done');
      }
      if (msg.type === 'INCLUDED_USAGE_RESULT') {
        setUsageResult({
          total:   (msg.total as string) ?? '',
          summary: (msg.summary as string) ?? '',
          auto:    (msg.auto as string) ?? '',
          api:     (msg.api as string) ?? '',
          error:   (msg.error as string | undefined),
        });
        setUsageState('done');
      }
      if (msg.type === 'ON_DEMAND_RESULT') {
        setOnDemandResult({
          displayText:  (msg.displayText as string) ?? '',
          usedDollars:  (msg.usedDollars as number) ?? 0,
          limitDollars: (msg.limitDollars as number) ?? 0,
          mode:         (msg.mode as string) ?? '',
          amount:       (msg.amount as number | null) ?? null,
          error:        (msg.error as string | undefined),
        });
        setOnDemandState('done');
      }
      if (msg.type === 'INTERRUPT_RESULT') {
        setInterruptResult({
          scenario:      (msg.scenario      as string)                   ?? '',
          dataCollected: (msg.dataCollected as number)                   ?? 0,
          interrupted:   (msg.interrupted   as boolean)                  ?? false,
          reason:        (msg.reason        as string)                   ?? '',
          checks:        (msg.checks        as Record<string, unknown>)  ?? {},
          error:         (msg.error         as string | undefined),
        });
        setInterruptState('done');
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  function triggerScrape() {
    chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE' }).catch(() => {});
  }

  function runHoverTest() {
    setHoverState('running');
    setHoverResult(null);
    chrome.runtime.sendMessage({ type: 'TEST_TOKEN_HOVER' }).catch((e: unknown) => {
      setHoverResult({ html: null, triggerText: '', parsed: null, portalCount: 0, error: String(e) });
      setHoverState('done');
    });
  }

  function runUserInfoTest() {
    setUserInfoState('running');
    setUserInfoResult(null);
    chrome.runtime.sendMessage({ type: 'TEST_USER_INFO' }).catch((e: unknown) => {
      setUserInfoResult({ name: '', plan: '', error: String(e) });
      setUserInfoState('done');
    });
  }

  function runPlanTest() {
    setPlanState('running'); setPlanResult(null);
    chrome.runtime.sendMessage({ type: 'TEST_SPENDING_PLAN' }).catch((e: unknown) => {
      setPlanResult({ plan: '', price: '', resetText: '', error: String(e) });
      setPlanState('done');
    });
  }

  function runUsageTest() {
    setUsageState('running'); setUsageResult(null);
    chrome.runtime.sendMessage({ type: 'TEST_INCLUDED_USAGE' }).catch((e: unknown) => {
      setUsageResult({ total: '', summary: '', auto: '', api: '', error: String(e) });
      setUsageState('done');
    });
  }

  function runOnDemandTest() {
    setOnDemandState('running'); setOnDemandResult(null);
    chrome.runtime.sendMessage({ type: 'TEST_ON_DEMAND' }).catch((e: unknown) => {
      setOnDemandResult({ displayText: '', usedDollars: 0, limitDollars: 0, mode: '', amount: null, error: String(e) });
      setOnDemandState('done');
    });
  }

  function runInterruptTest() {
    setInterruptState('running'); setInterruptResult(null);
    chrome.runtime.sendMessage({ type: 'TEST_INTERRUPT', scenario: interruptScenario }).catch((e: unknown) => {
      setInterruptResult({
        scenario: interruptScenario, dataCollected: 0, interrupted: false,
        reason: String(e), checks: {}, error: String(e),
      });
      setInterruptState('done');
    });
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm">

      {/* ── 顶栏 ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 shrink-0">
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <span>⚗️</span>
          <span>测试模式 · 自动采集已暂停</span>
        </span>
        <button
          onClick={onClose}
          className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 px-2 py-0.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-800/50 transition-colors"
        >
          退出
        </button>
      </div>

      {/* ── 上区块：正常（实时状态 + 采集触发） ── */}
      <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
        <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
          正常
        </p>

        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 px-3 py-2.5 space-y-1.5 text-xs font-mono mb-3">
          <SRow label="scrapeMode"     value={status.scrapeMode === 'manual' ? '🔴 manual (已暂停)' : `🟢 ${status.scrapeMode}`} />
          <SRow label="isRunning"      value={status.isRunning ? '🔵 true' : '⚫ false'} />
          <SRow label="loginRequired"  value={status.loginRequired ? '⚠️ true' : 'false'} />
          <SRow label="noDataCount"    value={`${status.noDataCount}  →  next ${interval} min`} />
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-1.5 space-y-1.5">
            <SRow label="usage.length" value={`${usage.length} 条`} />
            <SRow
              label="spending"
              value={spending
                ? `${spending.planName} ${spending.planPrice}  used=${spending.demandUsed}/${spending.demandLimit}`
                : '—'}
            />
            <SRow
              label="lastScrapeAt"
              value={status.lastScrapeAt ? new Date(status.lastScrapeAt).toLocaleTimeString() : '—'}
            />
          </div>
        </div>

        {/* 采集按钮：手动触发一次，会先点 30d 再采集所有页 */}
        <button
          onClick={triggerScrape}
          disabled={status.isRunning}
          className="w-full py-2 text-xs font-semibold bg-brand hover:bg-brand-hover disabled:opacity-40 text-white rounded-xl transition-colors"
        >
          {status.isRunning ? '采集中…' : '立即采集 (30d · 全量)'}
        </button>
      </div>

      {/* ── 下区块：测试（原始数据预览） ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
          测试 — 原始数据预览（最新 20 条）
        </p>

        {/* 用户信息解析测试卡 */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 mb-3">
          <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            用户信息解析测试
          </h4>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            从 cursor.com dashboard 侧边栏提取姓名和套餐（任意 dashboard 子页面均可）。
          </p>
          <button
            onClick={runUserInfoTest}
            disabled={userInfoState === 'running'}
            className="self-start px-3 py-1 text-xs bg-brand hover:bg-brand-hover disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {userInfoState === 'running' ? '读取中…' : '运行解析测试'}
          </button>

          {userInfoState === 'done' && userInfoResult && (
            <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              {userInfoResult.error ? (
                <div className="text-[10px] text-red-500 break-all">{userInfoResult.error}</div>
              ) : (
                <>
                  <div className="text-[10px] text-green-600 dark:text-green-400 font-semibold">✓ 解析成功！</div>
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400">name</span>
                      <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{userInfoResult.name || '—'}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-zinc-400">plan</span>
                      <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{userInfoResult.plan || '—'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Spending 页面专属测试 ── */}
        <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2 mt-4">
          Spending 页面测试（需先打开 spending 页）
        </p>

        {/* Test 1 · Plan + 到期 */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 mb-3">
          <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            Test 1 · 套餐 &amp; 重置日期
          </h4>
          <button onClick={runPlanTest} disabled={planState === 'running'}
            className="px-3 py-1 text-xs bg-brand hover:bg-brand-hover disabled:opacity-40 text-white rounded-lg transition-colors">
            {planState === 'running' ? '读取中…' : '运行'}
          </button>
          {planState === 'done' && planResult && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
              {planResult.error
                ? <div className="text-[10px] text-red-500 break-all">{planResult.error}</div>
                : <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 space-y-1">
                    <KVRow label="plan"      value={planResult.plan} />
                    <KVRow label="price"     value={planResult.price} />
                    <KVRow label="resetText" value={planResult.resetText} />
                  </div>
              }
            </div>
          )}
        </div>

        {/* Test 2 · Included Usage（需点击展开） */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 mb-3">
          <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            Test 2 · Included in Ultra 用量
          </h4>
          <p className="text-[10px] text-zinc-400">点击后自动展开 Auto/API 详情行（≤2s）。</p>
          <button onClick={runUsageTest} disabled={usageState === 'running'}
            className="px-3 py-1 text-xs bg-brand hover:bg-brand-hover disabled:opacity-40 text-white rounded-lg transition-colors">
            {usageState === 'running' ? '读取中…' : '运行'}
          </button>
          {usageState === 'done' && usageResult && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
              {usageResult.error
                ? <div className="text-[10px] text-red-500 break-all">{usageResult.error}</div>
                : <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 space-y-1">
                    <KVRow label="Total"   value={usageResult.total} />
                    <KVRow label="summary" value={usageResult.summary} />
                    <KVRow label="Auto+Composer" value={usageResult.auto || '—'} />
                    <KVRow label="API"     value={usageResult.api || '—'} />
                  </div>
              }
            </div>
          )}
        </div>

        {/* Test 3 · On-Demand */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 mb-3">
          <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            Test 3 · On-Demand 用量 &amp; Limit 配置
          </h4>
          <button onClick={runOnDemandTest} disabled={onDemandState === 'running'}
            className="px-3 py-1 text-xs bg-brand hover:bg-brand-hover disabled:opacity-40 text-white rounded-lg transition-colors">
            {onDemandState === 'running' ? '读取中…' : '运行'}
          </button>
          {onDemandState === 'done' && onDemandResult && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
              {onDemandResult.error
                ? <div className="text-[10px] text-red-500 break-all">{onDemandResult.error}</div>
                : <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 space-y-1">
                    <KVRow label="displayText" value={onDemandResult.displayText} />
                    <KVRow label="used"        value={`$${onDemandResult.usedDollars}`} />
                    <KVRow label="limit"       value={`$${onDemandResult.limitDollars}`} />
                    <KVRow label="mode"        value={onDemandResult.mode} />
                    <KVRow label="amount"      value={onDemandResult.amount !== null ? String(onDemandResult.amount) : '—'} />
                  </div>
              }
            </div>
          )}
        </div>

        {/* 中断模拟测试卡 */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 mb-3">
          <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            中断模拟测试 · validateBeforeCommit
          </h4>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            虚拟采集 + 强制注入失败条件，验证提交前守卫（三条防线）是否正确拦截。
            <br/>每个 scenario 均会必然触发守卫，数据不会写入 storage。
          </p>

          {/* Scenario 选择 */}
          <div className="flex gap-1.5 flex-wrap">
            {([
              ['logout',      '退出登录'],
              ['network',     '网络异常'],
              ['id_mismatch', 'ID 不匹配'],
            ] as [InterruptScenario, string][]).map(([s, label]) => (
              <button key={s} onClick={() => setInterruptScenario(s)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors
                  ${interruptScenario === s
                    ? 'bg-brand text-white border-brand'
                    : 'bg-transparent text-zinc-500 border-zinc-300 dark:border-zinc-600 hover:border-brand hover:text-brand'
                  }`}>
                {label}
              </button>
            ))}
          </div>

          <button onClick={runInterruptTest} disabled={interruptState === 'running'}
            className="px-3 py-1 text-xs bg-brand hover:bg-brand-hover disabled:opacity-40 text-white rounded-lg transition-colors">
            {interruptState === 'running' ? '测试中…' : `运行（${interruptScenario}）`}
          </button>

          {interruptState === 'done' && interruptResult && (
            <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              {interruptResult.error
                ? <div className="text-[10px] text-red-500 break-all">{interruptResult.error}</div>
                : <>
                    <div className={`text-[10px] font-semibold ${interruptResult.interrupted ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {interruptResult.interrupted ? '✓ 守卫触发 → 数据已丢弃' : '✗ 守卫未触发（请检查注入逻辑）'}
                    </div>
                    <KVRow label="场景"    value={interruptResult.scenario} />
                    <KVRow label="虚拟采集行数" value={String(interruptResult.dataCollected)} />
                    <KVRow label="拦截原因" value={interruptResult.reason} />
                    <div className="text-[10px] text-zinc-400 font-semibold mt-1">Checks 注入值：</div>
                    {Object.entries(interruptResult.checks).map(([k, v]) => (
                      <KVRow key={k} label={k} value={String(v)} />
                    ))}
                  </>
              }
            </div>
          )}
        </div>

        {/* Token 详情解析测试卡 */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2 mb-3">
          <h4 className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
            Token 详情解析测试
          </h4>
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            读取 usage 页面 DOM 中已有的 Radix HoverCard portal（无需 hover 模拟），
            解析 Cache Read / Write / Input / Output / Total。<br/>
            <span className="text-amber-500 font-semibold">提示：</span>先在 usage 页手动 hover 任意一行 token，再点运行。
          </p>
          <button
            onClick={runHoverTest}
            disabled={hoverState === 'running'}
            className="self-start px-3 py-1 text-xs bg-brand hover:bg-brand-hover disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {hoverState === 'running' ? '读取中…' : '运行解析测试'}
          </button>

          {hoverState === 'done' && hoverResult && (
            <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">

              {/* portal 数量 */}
              <div className="text-[10px] font-mono text-zinc-400">
                portals in DOM: <span className="text-zinc-700 dark:text-zinc-300">{hoverResult.portalCount}</span>
              </div>

              {hoverResult.error ? (
                <div className="text-[10px] text-red-500 break-all">{hoverResult.error}</div>
              ) : hoverResult.parsed && Object.keys(hoverResult.parsed).length > 0 ? (
                <>
                  <div className="text-[10px] text-green-600 dark:text-green-400 font-semibold">
                    ✓ 解析成功！
                  </div>
                  {/* parsed 数据表 */}
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 space-y-1">
                    {Object.entries(hoverResult.parsed).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-[10px] font-mono">
                        <span className={key === 'Total' ? 'font-semibold text-zinc-700 dark:text-zinc-200' : 'text-zinc-500'}>
                          {key}
                        </span>
                        <span className={key === 'Total' ? 'font-semibold text-zinc-700 dark:text-zinc-200' : 'text-zinc-600 dark:text-zinc-300'}>
                          {val.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-[10px] text-red-500">
                  portal 存在但解析为空（triggerText: {hoverResult.triggerText || '—'}）
                </div>
              )}
            </div>
          )}
        </div>

        {usage.length === 0 ? (
          <div className="text-xs text-zinc-400 text-center py-8">
            暂无数据 — 点击「立即采集」开始
          </div>
        ) : (
          <div className="space-y-2">
            {usage.slice(0, 20).map((r, i) => (
              <div
                key={i}
                className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-[10px] font-mono space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">#{i + 1}</span>
                  <span className={
                    r.type.toLowerCase().includes('on-demand')
                      ? 'text-orange-500'
                      : 'text-green-600 dark:text-green-400'
                  }>
                    {r.cost > 0 ? `$${r.cost.toFixed(4)}` : 'Incl.'}
                  </span>
                </div>
                <div className="text-zinc-400 truncate">{r.dt}</div>
                <div className="text-zinc-600 dark:text-zinc-300 truncate">{r.model}</div>
                <div className="flex gap-3 text-zinc-400">
                  <span>{r.tokens.toLocaleString()} tok</span>
                  <span className="truncate">{r.type}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-4" />
      </div>

    </div>
  );
}

// ─── 共用子组件 ───────────────────────────────────────────────────────────────

function SRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-zinc-400 shrink-0 min-w-[90px]">{label}:</span>
      <span className="text-zinc-700 dark:text-zinc-300 break-all">{value}</span>
    </div>
  );
}

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[10px] font-mono">
      <span className="text-zinc-400">{label}</span>
      <span className="text-zinc-700 dark:text-zinc-300 font-semibold text-right break-all max-w-[60%]">{value}</span>
    </div>
  );
}
