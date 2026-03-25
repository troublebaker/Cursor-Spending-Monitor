import {
  waitForElement,
  scrapeAllPages,
  scrapeIncremental,
  parseSpending,
  parseUserInfo,
  parseSpendingPlanInfo,
  parseOnDemandInfo,
  isLoggedIn,
  sleep,
  click30dFilter,
} from '../utils/parser';
import type { ScrapeParams } from '../utils/types';

const USAGE_SELECTOR = '.dashboard-table-rows';
const SCRAPE_TIMEOUT_MS = 15_000;

function detectPage(): 'usage' | 'spending' | null {
  const path = location.pathname;
  if (path.includes('/dashboard/usage')) return 'usage';
  if (path.includes('/dashboard/spending')) return 'spending';
  return null;
}

// ─── Token 详情 hover 测试 ────────────────────────────────────────────────────

/**
 * 解析一个 [data-radix-popper-content-wrapper] 元素，提取
 * Cache Read / Cache Write / Input / Output / Total 的数值。
 *
 * 结构示例（已通过真实 DOM 验证 2026-03-25）：
 * <div class="flex justify-between ...">
 *   <span>Cache Read</span>
 *   <span class="tabular-nums">506,128</span>
 * </div>
 */
function parseTokenBreakdown(wrapper: Element): Record<string, number> {
  const result: Record<string, number> = {};
  wrapper.querySelectorAll('.flex.justify-between').forEach(row => {
    const spans = Array.from(row.querySelectorAll('span'));
    if (spans.length < 2) return;
    const label = spans[0].textContent?.trim() ?? '';
    const raw   = spans[spans.length - 1].textContent ?? '';
    const value = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (label && !isNaN(value)) result[label] = value;
  });
  return result;
}

/**
 * 最小测试：读取已在 DOM 中的 Radix HoverCard portal，无需 hover 模拟。
 *
 * 原理：Radix HoverCard 第一次 hover 后 portal 就留在 DOM（data-state="closed"），
 * 内容仍然存在，直接 querySelectorAll('[data-radix-popper-content-wrapper]') 即可。
 * 若用户尚未手动 hover 任意行，则尝试一次带坐标的合成事件兜底。
 */
async function testTokenHover(): Promise<{
  html: string | null;
  triggerText: string;
  parsed: Record<string, number> | null;
  portalCount: number;
  error?: string;
}> {
  // ── 1. 优先：查已有 portal（closed 状态也有完整内容） ────────────────────────
  const existingPortals = Array.from(
    document.querySelectorAll('[data-radix-popper-content-wrapper]'),
  );

  if (existingPortals.length > 0) {
    const first = existingPortals[0];
    const parsed = parseTokenBreakdown(first);
    console.log('[cursor-stats] TOKEN_HOVER found existing portals:', existingPortals.length, parsed);
    return {
      html:         first.outerHTML.slice(0, 1000),
      triggerText:  first.querySelector('.tabular-nums')?.textContent?.trim() ?? '(existing portal)',
      parsed,
      portalCount:  existingPortals.length,
    };
  }

  // ── 2. 兜底：找 trigger，派发事件，观察 portal 插入或 data-state 变化 ────────
  const trigger = document.querySelector(
    '.inline-block.cursor-help[data-state]',
  ) as HTMLElement | null;

  if (!trigger) {
    return { html: null, triggerText: '', parsed: null, portalCount: 0,
      error: 'cursor-help trigger not found（usage 页面是否已加载？）' };
  }

  const triggerText = trigger.textContent?.trim() ?? '';
  let capturedWrapper: Element | null = null;

  // 同时观察：body 新增节点 + 整棵树里 data-state 属性变化
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node instanceof HTMLElement && node.hasAttribute('data-radix-popper-content-wrapper')) {
          capturedWrapper = node;
        }
      }
      if (m.type === 'attributes' && m.target instanceof HTMLElement) {
        const w = m.target.closest?.('[data-radix-popper-content-wrapper]');
        if (w && (m.target as HTMLElement).dataset.state === 'open') {
          capturedWrapper = w;
        }
      }
    }
  });
  obs.observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['data-state'],
  });

  // 带真实坐标的事件（React 通过 pointerover 冒泡处理 onPointerEnter）
  const rect = trigger.getBoundingClientRect();
  const cx   = rect.left + rect.width / 2;
  const cy   = rect.top  + rect.height / 2;
  const base: PointerEventInit = {
    bubbles: true, cancelable: true,
    clientX: cx, clientY: cy, screenX: cx, screenY: cy,
    pointerType: 'mouse', isPrimary: true,
  };

  trigger.dispatchEvent(new PointerEvent('pointerover',  base));
  trigger.dispatchEvent(new PointerEvent('pointerenter', base));
  trigger.dispatchEvent(new MouseEvent('mouseover',  base));
  trigger.dispatchEvent(new MouseEvent('mouseenter', base));

  // 等待最多 3s（Radix HoverCard openDelay 默认 700ms + 渲染）
  const startMs = Date.now();
  while (!capturedWrapper && Date.now() - startMs < 3_000) {
    // 每轮也重查一次（防止 Observer 遗漏）
    capturedWrapper = document.querySelector('[data-radix-popper-content-wrapper]');
    if (!capturedWrapper) await sleep(150);
  }

  obs.disconnect();
  trigger.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
  trigger.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

  if (!capturedWrapper) {
    return {
      html: null, triggerText, parsed: null, portalCount: 0,
      error: `portal 未出现（data-state=${trigger.getAttribute('data-state')}）。` +
             `请先在 usage 页面手动将鼠标移到任意 token 行上，然后再运行本测试。`,
    };
  }

  const parsed = parseTokenBreakdown(capturedWrapper);
  console.log('[cursor-stats] TOKEN_HOVER simulated result:', parsed);
  return {
    html:        capturedWrapper.outerHTML.slice(0, 1000),
    triggerText,
    parsed,
    portalCount: 1,
  };
}

// ─── Spending 页面测试函数 ──────────────────────────────────────────────────────

/** Test 1：解析 Current Plan（套餐名 + 价格 + 重置日期） */
function spendingTestPlan() {
  if (!location.pathname.includes('/dashboard/spending')) {
    return { plan: '', price: '', resetText: '', error: '当前不在 spending 页面，请先打开 cursor.com/*/dashboard/spending' };
  }
  const info = parseSpendingPlanInfo(document);
  if (!info) return { plan: '', price: '', resetText: '', error: 'selector not found（页面是否已加载？）' };
  return info;
}

/**
 * Test 2：点击 "X% Auto and Y% API used" 展开行，解析 Auto + Composer / API 百分比。
 *
 * 关键：chevron-up = 已展开（不能再点，否则折叠）；chevron-down = 已折叠需点击。
 * 展开内容在同一 .dashboard-subSection 容器内，直接 querySelectorAll 即可。
 */
async function spendingTestIncludedUsage(): Promise<{
  total: string; summary: string; auto: string; api: string; error?: string;
}> {
  if (!location.pathname.includes('/dashboard/spending')) {
    return { total: '', summary: '', auto: '', api: '', error: '当前不在 spending 页面' };
  }

  // 找可展开/折叠的摘要行
  const expandRow = Array.from(document.querySelectorAll<HTMLElement>('div.cursor-pointer'))
    .find(el => /Auto and.*API used/i.test(el.textContent ?? ''));
  const summary = expandRow?.querySelector('span')?.textContent?.trim() ?? '';

  // 找 Total % 行（在同一 subSection 容器里）
  const container = expandRow?.closest('.dashboard-subSection') ?? document.body;
  const totalRow  = Array.from(container.querySelectorAll<HTMLElement>('.flex.justify-between.items-center'))
    .find(el => el.querySelector('span')?.textContent?.trim() === 'Total');
  const total = totalRow?.querySelector<HTMLElement>('span.font-medium')?.textContent?.trim()
             ?? totalRow?.querySelectorAll('span')[1]?.textContent?.trim() ?? '';

  if (!expandRow) {
    return parseExpandedUsageRows(null, container, total, summary);
  }

  // chevron-up = 已展开；chevron-down = 已折叠
  const alreadyExpanded = !!expandRow.querySelector('.lucide-chevron-up');

  if (alreadyExpanded) {
    // 已展开，直接解析，不能再 click（否则折叠）
    return parseExpandedUsageRows(expandRow, container, total, summary);
  }

  // 已折叠，click 展开，观察 DOM 变化
  let changed = false;
  const obs = new MutationObserver(() => { changed = true; });
  obs.observe(container, { childList: true, subtree: true });

  expandRow.click();

  const startMs = Date.now();
  while (!changed && Date.now() - startMs < 2_000) await sleep(100);
  obs.disconnect();
  await sleep(200);

  return parseExpandedUsageRows(expandRow, container, total, summary);
}

/**
 * 从展开面板里解析 Auto + Composer / API 百分比。
 *
 * 展开面板是 expandRow 的 nextElementSibling（.flex.flex-col.gap-4...），
 * 里面的行用 .flex.justify-between.text-secondary（无 items-center）。
 * 所以不能用 .flex.justify-between.items-center，改用 .flex.justify-between。
 */
function parseExpandedUsageRows(
  expandRow: HTMLElement | null,
  container: Element,
  total: string,
  summary: string,
): { total: string; summary: string; auto: string; api: string } {
  let auto = '', api = '';

  // 优先在展开面板（expandRow 的下一个兄弟节点）里精确搜索
  const panel = expandRow?.nextElementSibling ?? null;
  const root  = panel ?? container;

  root.querySelectorAll<HTMLElement>('.flex.justify-between').forEach(row => {
    // 只取直接子 span（避免嵌套 span 的干扰）
    const spans = Array.from(row.querySelectorAll(':scope > span'));
    if (spans.length < 2) return;
    const label = spans[0].textContent?.trim() ?? '';
    const value = spans[spans.length - 1].textContent?.trim() ?? '';
    if (/Auto.*Composer/i.test(label)) auto = value;
    if (label === 'API')               api  = value;
  });
  return { total, summary, auto, api };
}

/** Test 3：解析 On-Demand 金额 + Monthly Limit 配置 */
function spendingTestOnDemand() {
  if (!location.pathname.includes('/dashboard/spending')) {
    return { displayText: '', usedDollars: 0, limitDollars: 0, mode: '', amount: null,
      error: '当前不在 spending 页面' };
  }
  const info = parseOnDemandInfo(document);
  if (!info) return { displayText: '', usedDollars: 0, limitDollars: 0, mode: '', amount: null,
    error: '#on-demand-usage 未找到（页面是否已加载？）' };
  return info;
}

// ── 中断守卫（三条防线，可复用于真实采集流程） ────────────────────────────────

interface ScrapeValidationChecks {
  isLoggedIn:  boolean;
  httpOk:      boolean;
  userId:      string;
  storedId:    string;
}

/**
 * 提交前校验：三条防线依次检查。
 * 任意一条失败 → 返回 valid=false + reason，调用方应丢弃临时数据，不写入 storage。
 */
function validateBeforeCommit(
  checks: ScrapeValidationChecks,
): { valid: boolean; reason?: string } {
  if (!checks.isLoggedIn) return { valid: false, reason: '用户已退出登录' };
  if (!checks.httpOk)     return { valid: false, reason: '网络异常（HTTP 非 200）' };
  if (checks.userId !== checks.storedId)
    return { valid: false, reason: `用户 ID 不匹配（当前 "${checks.userId}" ≠ 已存 "${checks.storedId}"）` };
  return { valid: true };
}

/**
 * 中断模拟测试：虚拟采集 + 注入指定失败条件，验证 validateBeforeCommit 是否拦截。
 *
 * 每个 scenario 都会强制让对应条件为 false，使守卫必然触发，
 * 从而确定性地演示"采集中断 → 数据丢弃"路径。
 *
 * scenario 说明：
 *  logout      → isLoggedIn 强制注入 false（模拟用户退出登录）
 *  network     → httpOk     强制注入 false（模拟 404 / 断网）
 *  id_mismatch → storedId   注入 'WRONG_ID_INJECTED'（模拟账号切换/ID 变化）
 */
async function testInterruptScrape(
  scenario: 'logout' | 'network' | 'id_mismatch',
): Promise<{
  scenario:       string;
  dataCollected:  number;
  interrupted:    boolean;
  reason:         string;
  checks:         Record<string, unknown>;
}> {
  // ── Step 1：虚拟采集（读取当前页面可见行数，不写入 storage） ──────────────────
  const visibleRows   = document.querySelectorAll('tr').length;
  const dataCollected = visibleRows > 0 ? visibleRows : 5; // 至少模拟 5 条

  // ── Step 2：取页面真实值 ────────────────────────────────────────────────────
  const realLoggedIn = isLoggedIn();
  const realUserId   = (
    document.querySelector<HTMLImageElement>('img[alt]')?.alt?.trim() ||
    document.querySelector('[data-user-id]')?.getAttribute('data-user-id') ||
    'unknown'
  );

  // ── Step 3：按 scenario 注入失败条件（保证守卫一定触发） ──────────────────────
  const checks: ScrapeValidationChecks = {
    isLoggedIn: scenario === 'logout'      ? false      : realLoggedIn,
    httpOk:     scenario === 'network'     ? false      : true,
    userId:     realUserId,
    storedId:   scenario === 'id_mismatch' ? 'WRONG_ID_INJECTED' : realUserId,
  };

  // ── Step 4：执行守卫 ──────────────────────────────────────────────────────────
  const result = validateBeforeCommit(checks);

  return {
    scenario,
    dataCollected,
    interrupted: !result.valid,
    reason:      result.reason ?? '校验全部通过 → 数据可提交至 storage',
    checks:      { ...checks } as Record<string, unknown>,
  };
}


/** 读取当前页面的用户标识（采集开始 / 提交前各读一次，用于 ID 一致性检测）*/
function readCurrentUserId(): string {
  return (
    document.querySelector<HTMLImageElement>('img[alt]')?.alt?.trim() ||
    document.querySelector('[data-user-id]')?.getAttribute('data-user-id') ||
    'unknown'
  );
}

/**
 * 提交前实时运行三条守卫：
 *   1. isLoggedIn — 重新检测 DOM 登录状态
 *   2. httpOk     — 先查 navigator.onLine（绕过 SW 缓存），再做 HEAD 请求
 *   3. userId     — 对比采集开始时的用户 ID（防账号切换）
 */
async function runPreCommitGuard(
  initialUserId: string,
): Promise<{ valid: boolean; reason?: string }> {
  const currentIsLoggedIn = isLoggedIn();

  // ① 先检查浏览器底层网络状态（SW 无法绕过）
  // ② 如果 onLine=true，再做 HEAD 请求做二次确认
  //    cache: 'no-cache' 强制向服务器重新验证（no-store 不阻止 SW 返回缓存）
  let httpOk = navigator.onLine;
  if (httpOk) {
    try {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), 3_000);
      const resp = await fetch(location.href, {
        method: 'HEAD', cache: 'no-cache', signal: ctrl.signal,
      });
      clearTimeout(tid);
      httpOk = resp.ok || resp.status === 405;
    } catch {
      httpOk = false;
    }
  }

  const checks: ScrapeValidationChecks = {
    isLoggedIn: currentIsLoggedIn,
    httpOk,
    userId:  readCurrentUserId(),
    storedId: initialUserId,
  };
  return validateBeforeCommit(checks);
}

// 采集完成后、写入 storage 前的等待窗口（毫秒）。
// 正式发布时改为 0；当前保留 5s 供手动验证中断场景（退出登录 / 断网）。
const PRE_COMMIT_DELAY_MS = 5_000;

async function doScrape(
  page: 'usage' | 'spending',
  isIncremental: boolean,
  cutoffIso: string | null,
): Promise<void> {
  // ── Step 1: 记录采集开始时的用户 ID（ID 守卫基准） ────────────────────────
  const initialUserId = readCurrentUserId();

  // ── Step 2: 采集 → 写入临时变量，不直接发往 storage ─────────────────────
  let usageRecords: Awaited<ReturnType<typeof scrapeAllPages>> | null = null;
  let spendingData: ReturnType<typeof parseSpending>           | null = null;

  if (page === 'usage') {
    await click30dFilter();
    usageRecords = isIncremental && cutoffIso
      ? await scrapeIncremental(new Date(cutoffIso))
      : await scrapeAllPages();
    console.log(`[cursor-stats] usage collected: ${usageRecords.length} rows — 等待守卫校验…`);
  } else {
    spendingData = parseSpending();
    console.log('[cursor-stats] spending collected — 等待守卫校验…');
  }

  // ── Step 3: 守卫等待窗口（当前 5s，便于手动触发中断场景）────────────────
  await sleep(PRE_COMMIT_DELAY_MS);

  // ── Step 4: 提交前三条防线校验 ───────────────────────────────────────────
  const guard = await runPreCommitGuard(initialUserId);
  if (!guard.valid) {
    console.warn(`[cursor-stats] 提交前校验失败 → 数据丢弃: ${guard.reason}`);
    const errorType = guard.reason?.includes('退出登录') ? 'logout' : 'generic';
    chrome.runtime.sendMessage({
      type:      'SCRAPE_ERROR',
      error:     `提交前校验失败：${guard.reason}`,
      errorType,
      page,
    }).catch(() => {});
    return;
  }

  // ── Step 5: 校验通过 → 写入 storage ──────────────────────────────────────
  if (page === 'usage' && usageRecords !== null) {
    chrome.runtime.sendMessage({ type: 'USAGE_DATA', records: usageRecords, isIncremental }).catch(() => {});
    console.log(`[cursor-stats] usage committed: ${usageRecords.length} records (incr=${isIncremental})`);
  } else if (page === 'spending' && spendingData !== null) {
    chrome.runtime.sendMessage({ type: 'SPENDING_DATA', spending: spendingData }).catch(() => {});
    console.log('[cursor-stats] spending committed');
  }
}

async function runScrape(page: 'usage' | 'spending'): Promise<void> {
  // 等待 SPA 内容渲染
  if (page === 'usage') {
    await waitForElement(USAGE_SELECTOR, 15_000);
  } else {
    await waitForElement('main', 8_000).catch(() => sleep(2_000));
  }

  // 通知 background 就绪，拿回采集参数
  let params: ScrapeParams | null = null;
  try {
    params = await chrome.runtime.sendMessage({ type: 'PAGE_READY', page }) as ScrapeParams | null;
  } catch {
    // background SW 未响应（极少情况），按全量兜底
  }

  if (params) {
    await doScrape(page, params.isIncremental, params.cutoffIso);
  } else {
    await doScrape(page, false, null);
  }
}

export default defineContentScript({
  matches: [
    // ── usage 页面（带/不带 locale 前缀，含 ?page=N 等查询参数） ─────────────────
    'https://cursor.com/*/dashboard/usage',
    'https://cursor.com/*/dashboard/usage?*',
    'https://cursor.com/*/dashboard/usage/*',
    'https://cursor.com/dashboard/usage',
    'https://cursor.com/dashboard/usage?*',
    'https://cursor.com/dashboard/usage/*',
    'https://www.cursor.com/*/dashboard/usage',
    'https://www.cursor.com/*/dashboard/usage?*',
    'https://www.cursor.com/dashboard/usage',
    'https://www.cursor.com/dashboard/usage?*',
    // ── spending 页面（同上） ──────────────────────────────────────────────────
    'https://cursor.com/*/dashboard/spending',
    'https://cursor.com/*/dashboard/spending?*',
    'https://cursor.com/*/dashboard/spending/*',
    'https://cursor.com/dashboard/spending',
    'https://cursor.com/dashboard/spending?*',
    'https://cursor.com/dashboard/spending/*',
    'https://www.cursor.com/*/dashboard/spending',
    'https://www.cursor.com/*/dashboard/spending?*',
    'https://www.cursor.com/dashboard/spending',
    'https://www.cursor.com/dashboard/spending?*',
    // ── dashboard 根页面（用户信息所在） ─────────────────────────────────────────
    'https://cursor.com/*/dashboard',
    'https://cursor.com/*/dashboard/',
    'https://cursor.com/dashboard',
    'https://cursor.com/dashboard/',
    'https://www.cursor.com/*/dashboard',
    'https://www.cursor.com/dashboard',
  ],

  async main() {
    // ── 持久消息监听：先注册，后做 detectPage 判断 ─────────────────────────────
    // 这样即使页面是 dashboard 根页面（detectPage 返回 null），
    // 来自 background 的测试指令也能被正常处理。
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === 'TEST_TOKEN_HOVER') {
        testTokenHover().then(result => {
          chrome.runtime.sendMessage({ type: 'TOKEN_HOVER_RESULT', ...result }).catch(() => {});
          sendResponse({ ok: true });
        }).catch((e: unknown) => {
          chrome.runtime.sendMessage({
            type: 'TOKEN_HOVER_RESULT',
            html: null,
            triggerText: '',
            parsed: null,
            portalCount: 0,
            error: String(e),
          }).catch(() => {});
          sendResponse({ ok: false });
        });
        return true;
      }

      if (msg.type === 'TEST_USER_INFO') {
        const info = parseUserInfo(document);
        if (info) {
          chrome.runtime.sendMessage({ type: 'USER_INFO_RESULT', name: info.name, plan: info.plan }).catch(() => {});
        } else {
          chrome.runtime.sendMessage({ type: 'USER_INFO_RESULT', name: '', plan: '', error: 'selector not found（请确认已在 cursor.com 任意 dashboard 页）' }).catch(() => {});
        }
        sendResponse({ ok: true });
        return false;
      }

      if (msg.type === 'TEST_SPENDING_PLAN') {
        const r = spendingTestPlan();
        chrome.runtime.sendMessage({ type: 'SPENDING_PLAN_RESULT', ...r }).catch(() => {});
        sendResponse({ ok: true });
        return false;
      }

      if (msg.type === 'TEST_INCLUDED_USAGE') {
        (async () => {
          const r = await spendingTestIncludedUsage();
          chrome.runtime.sendMessage({ type: 'INCLUDED_USAGE_RESULT', ...r }).catch(() => {});
          sendResponse({ ok: true });
        })();
        return true;
      }

      if (msg.type === 'TEST_ON_DEMAND') {
        const r = spendingTestOnDemand();
        chrome.runtime.sendMessage({ type: 'ON_DEMAND_RESULT', ...r }).catch(() => {});
        sendResponse({ ok: true });
        return false;
      }

      if (msg.type === 'TEST_INTERRUPT') {
        (async () => {
          try {
            const r = await testInterruptScrape(msg.scenario as 'logout' | 'network' | 'id_mismatch');
            chrome.runtime.sendMessage({ type: 'INTERRUPT_RESULT', ...r }).catch(() => {});
          } catch (e: unknown) {
            chrome.runtime.sendMessage({
              type: 'INTERRUPT_RESULT',
              scenario:      msg.scenario,
              dataCollected: 0,
              interrupted:   false,
              reason:        String(e),
              checks:        {},
              error:         String(e),
            }).catch(() => {});
          }
          sendResponse({ ok: true });
        })();
        return true;
      }

    });

    // ── 以下是采集逻辑，仅在 usage / spending 页面运行 ──────────────────────────
    const page = detectPage();
    if (!page) return;

    console.log(`[cursor-stats] injected on ${page} page`);

    if (!isLoggedIn()) {
      chrome.runtime.sendMessage({ type: 'NOT_LOGGED_IN' });
      return;
    }

    // 30 秒全局超时：任何阶段卡死都会触发 SCRAPE_ERROR，background 重置状态
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('scrape timeout (30s)')), SCRAPE_TIMEOUT_MS),
    );

    try {
      await Promise.race([runScrape(page), timeout]);
    } catch (e) {
      console.error('[cursor-stats] scrape error', e);
      const msg = e instanceof Error ? e.message : String(e);
      // Extension context invalidated：扩展热重载导致，静默退出即可，不尝试 sendMessage
      if (msg.includes('context invalidated') || msg.includes('Extension context')) return;
      const errorType = msg.includes('timeout') ? 'timeout' : 'generic';
      chrome.runtime.sendMessage({
        type: 'SCRAPE_ERROR',
        error: msg,
        errorType,
        page,
      }).catch(() => {});
    }
  },
});
