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
import type { ScrapeParams, TokenBreakdown } from '../utils/types';

// ── content script 内嵌 chrome.storage 轻量 helpers（不可 import wxt/storage）──
const USER_NAME_KEY = 'knownUserName';
async function getUserName(): Promise<string> {
  const r = await chrome.storage.local.get(USER_NAME_KEY);
  return (r[USER_NAME_KEY] as string) ?? 'unknown';
}
async function setUserName(v: string): Promise<void> {
  await chrome.storage.local.set({ [USER_NAME_KEY]: v });
}

const USAGE_SELECTOR     = '.dashboard-table-rows';
const SCRAPE_TIMEOUT_MS  = 20_000;
const SLOW_SCRAPE_MAX_MS = 20 * 60 * 1_000; // 20 分钟硬上限
const SLOW_STALE_MS      = 30_000;           // 30 秒无新数据 → 超时

/** 慢速采集取消标志，由 SLOW_SCRAPE_CANCEL 消息设置 */
let slowScrapeCancelled = false;
/** 正常采集取消标志，由 CANCEL_SCRAPE 消息设置（background 不再导航离开，靠此标志中止） */
let normalScrapeCancelled = false;

// ─── 慢速采集专用可中断工具 ────────────────────────────────────────────────────

/**
 * 可中断的 sleep：每 50ms 检查一次 slowScrapeCancelled，
 * 收到取消信号后立即 resolve（不等满 ms）。
 */
async function sleepCancellable(ms: number): Promise<void> {
  const step = 50;
  let elapsed = 0;
  while (elapsed < ms && !slowScrapeCancelled) {
    await sleep(Math.min(step, ms - elapsed));
    elapsed += step;
  }
}

/**
 * 可中断的 waitForElement：每 150ms 查 DOM 一次，
 * 收到取消信号时立即抛出 'cancelled'（不等到超时）。
 */
async function waitForElementCancellable(selector: string, timeoutMs: number): Promise<Element> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (slowScrapeCancelled) throw new Error('cancelled');
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(150);
  }
  throw new Error(`waitForElement timeout: ${selector}`);
}

function detectPage(): 'usage' | 'spending' | null {
  const path = location.pathname;
  if (path.includes('/dashboard/usage')) return 'usage';
  if (path.includes('/dashboard/spending')) return 'spending';
  return null;
}

// ─── 慢速 hover 采集 ──────────────────────────────────────────────────────────

/** 从当前页面分页文本（如 "3 / 8"）提取总页数 */
function getTotalPages(): number {
  const txt = document.querySelector('span.mx-2.text-base.font-medium')?.textContent?.trim() ?? '';
  const m = txt.match(/\d+\s*\/\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

/** 从行 DOM 提取 "dateISO|modelTitle" 唯一键（与 usageStorage 中 r.dt|r.model 对齐） */
function extractRowKey(row: Element): string | null {
  const cells = Array.from(row.querySelectorAll('[role="cell"]'));
  if (cells.length < 3) return null;
  const rawDt = cells[0].querySelector('span[title]')?.getAttribute('title')
             ?? cells[0].textContent?.trim() ?? '';
  if (!rawDt) return null;
  // 与 parseRow 保持一致：优先解析为 ISO，失败则保留原始字符串
  const parsedDate = new Date(rawDt);
  const dt = isNaN(parsedDate.getTime()) ? rawDt : parsedDate.toISOString();
  const model = cells[2].querySelector('span[title]')?.getAttribute('title')
             ?? cells[2].textContent?.trim() ?? '';
  if (!dt || !model) return null;
  return `${dt}|${model}`;
}

/**
 * 对一个 hover-trigger 元素执行合成事件，等待 Radix HoverCard portal 出现，
 * 解析 Token 明细（Cache Read / Cache Write / Input / Output）。
 *
 * 策略（三步）：
 *  1. 先检查已有 closed portal（Radix 复用 portal，第二次后 data-state=closed 但内容仍在）
 *  2. 确保元素在视口内（scrollIntoView），触发合成 hover 事件
 *  3. 等待 portal 变成 open 状态（最多 2.5s）
 */
async function hoverAndParseBreakdown(trigger: HTMLElement): Promise<TokenBreakdown | null> {
  // ── 1. 先尝试读已有 portal（避免重复 hover 的副作用） ────────────────────
  // 找离 trigger 最近的 portal：遍历所有已有 portal，解析后返回第一个有数据的
  const existing = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]'));
  // 注意：Radix HoverCard 每个 trigger 对应独立 portal，尝试精确绑定是困难的
  // 这里的策略：hover 触发后 data-state 变为 open，先记录当前 open portal 的内容
  const openBefore = existing.find(p => p.querySelector('[data-state="open"]'));
  if (openBefore) {
    // 有另一行正在悬停，跳过（避免读错数据）
  }

  // ── 2. scroll into view + 触发 hover ─────────────────────────────────────
  trigger.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  await sleep(50); // 等待滚动完成

  const rect = trigger.getBoundingClientRect();
  const cx   = rect.left + rect.width / 2;
  const cy   = rect.top  + rect.height / 2;
  const base: PointerEventInit = {
    bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy,
  };

  let captured: Element | null = null;
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node instanceof HTMLElement && node.hasAttribute('data-radix-popper-content-wrapper'))
          captured = node;
      }
      if (m.type === 'attributes' && m.target instanceof HTMLElement) {
        const w = m.target.closest?.('[data-radix-popper-content-wrapper]');
        if (w && (m.target as HTMLElement).dataset.state === 'open') captured = w;
      }
    }
  });
  obs.observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['data-state'],
  });

  trigger.dispatchEvent(new PointerEvent('pointerover',  { ...base, pointerId: 1 }));
  trigger.dispatchEvent(new PointerEvent('pointerenter', { ...base, pointerId: 1 }));
  trigger.dispatchEvent(new MouseEvent('mouseenter', { ...base }));
  trigger.dispatchEvent(new MouseEvent('mouseover',  { ...base }));

  // ── 3. 等待 portal open（最多 2.5s，Radix 默认 openDelay=700ms）───────────
  await new Promise<void>(resolve => {
    const deadline = setTimeout(() => { obs.disconnect(); resolve(); }, 2_500);
    const poll = setInterval(() => {
      if (captured || slowScrapeCancelled) {
        clearInterval(poll); clearTimeout(deadline); obs.disconnect(); resolve();
      }
    }, 50);
  });

  // 如果等待超时，尝试读任意 open 状态的 portal 作为 fallback
  if (!captured) {
    const openPortal = document.querySelector('[data-radix-popper-content-wrapper] [data-state="open"]');
    if (openPortal) captured = openPortal.closest('[data-radix-popper-content-wrapper]');
  }

  // 离开
  trigger.dispatchEvent(new PointerEvent('pointerout',   { ...base, pointerId: 1 }));
  trigger.dispatchEvent(new PointerEvent('pointerleave', { ...base, pointerId: 1 }));
  trigger.dispatchEvent(new MouseEvent('mouseleave', { ...base }));

  if (!captured) return null;

  // 从 portal 解析五行数据
  const raw: Record<string, number> = {};
  (captured as Element).querySelectorAll('.flex.justify-between').forEach(row => {
    const spans = Array.from(row.querySelectorAll('span'));
    if (spans.length < 2) return;
    const label = spans[0].textContent?.trim() ?? '';
    const value = parseInt((spans[spans.length - 1].textContent ?? '').replace(/[^0-9]/g, ''), 10);
    if (label && !isNaN(value)) raw[label] = value;
  });

  const cacheRead  = raw['Cache Read']  ?? 0;
  const cacheWrite = raw['Cache Write'] ?? 0;
  const input      = raw['Input']       ?? 0;
  const output     = raw['Output']      ?? 0;

  if (cacheRead + cacheWrite + input + output === 0) return null;
  return { cacheRead, cacheWrite, input, output };
}

/**
 * 慢速全量 hover 采集：遍历所有分页，每行 hover 取 Token 明细。
 *
 * 守卫（仅两条）：① 退出登录  ② 账号切换
 * 超时机制：30s 无新行数据 → 主动中止
 * 取消：检查 slowScrapeCancelled 标志
 *
 * 每页完成后发送 SLOW_SCRAPE_PAGE 给 background，由 background 合并写入 storage 并推 inbox 消息。
 */
async function slowScrapeAllPages(existingKeys: Set<string> = new Set()): Promise<void> {
  let lastDataAt = Date.now();
  let pageNum    = 1;

  const storedName = await getUserName();

  while (!slowScrapeCancelled) {
    // ── 等待表格加载 ─────────────────────────────────────────────────────────
    try {
      await waitForElementCancellable(USAGE_SELECTOR, 10_000);
    } catch {
      if (slowScrapeCancelled) return; // 取消导致的退出，静默处理
      chrome.runtime.sendMessage({
        type: 'SLOW_SCRAPE_PAGE', page: pageNum, totalPages: 0,
        rowsUpdated: 0, breakdown: {}, error: '等待表格超时',
      }).catch(() => {});
      return;
    }
    await sleepCancellable(400);

    // ── 守卫 1: 登录 ──────────────────────────────────────────────────────────
    if (!isLoggedIn()) {
      chrome.runtime.sendMessage({
        type: 'SLOW_SCRAPE_PAGE', page: pageNum, totalPages: 0,
        rowsUpdated: 0, breakdown: {}, error: '已退出登录',
      }).catch(() => {});
      return;
    }

    // ── 守卫 2: 账号切换（storedName 有效才比对） ─────────────────────────────
    const currentName = readCurrentUserId();
    if (currentName !== 'unknown' && storedName !== 'unknown' && currentName !== storedName) {
      chrome.runtime.sendMessage({
        type: 'SLOW_SCRAPE_PAGE', page: pageNum, totalPages: 0,
        rowsUpdated: 0, breakdown: {}, error: `账号已切换（${currentName} ≠ ${storedName}）`,
      }).catch(() => {});
      return;
    }

    const totalPages   = getTotalPages();
    const rows         = Array.from(document.querySelectorAll(`${USAGE_SELECTOR} > *`));
    const pageBreakdown: Record<string, TokenBreakdown> = {};
    let rowsUpdated    = 0;

    for (const row of rows) {
      if (slowScrapeCancelled) break; // 收到取消指令立刻中断当前页剩余行

      // 插件 context 失效（extension disabled / reloaded）→ 立刻退出
      if (!chrome.runtime?.id) { slowScrapeCancelled = true; break; }

      // 30s 无新数据 → 超时
      if (Date.now() - lastDataAt > SLOW_STALE_MS) {
        chrome.runtime.sendMessage({
          type: 'SLOW_SCRAPE_PAGE', page: pageNum, totalPages,
          rowsUpdated: 0, breakdown: {}, error: '30秒无新数据，自动超时',
        }).catch(() => {});
        return;
      }

      const key = extractRowKey(row);
      if (!key) continue;

      // 增量：已有 tokenBreakdown 则跳过，不重复 hover
      if (existingKeys.has(key)) continue;

      const cells = Array.from(row.querySelectorAll('[role="cell"]'));
      if (cells.length < 4) continue;
      const tokenCell = cells[3];
      const trigger   = tokenCell.querySelector<HTMLElement>('.inline-block.cursor-help[data-state]')
                     ?? tokenCell.querySelector<HTMLElement>('.inline-block[data-state]');
      if (!trigger) continue;

      const breakdown = await hoverAndParseBreakdown(trigger);
      if (breakdown) {
        pageBreakdown[key] = breakdown;
        rowsUpdated++;
        lastDataAt = Date.now();
      }

      await sleepCancellable(150); // 温柔节奏，不触发速率限制
    }

    // ── 上报本页结果 ──────────────────────────────────────────────────────────
    chrome.runtime.sendMessage({
      type: 'SLOW_SCRAPE_PAGE', page: pageNum, totalPages, rowsUpdated, breakdown: pageBreakdown,
    }).catch(() => {});

    if (slowScrapeCancelled) break;

    // ── 翻到下一页 ────────────────────────────────────────────────────────────
    const next = document.querySelector<HTMLButtonElement>('[aria-label="Next page"]');
    if (!next || next.getAttribute('aria-disabled') === 'true') break;
    next.click();
    await sleepCancellable(800);
    pageNum++;
  }
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
 *   2. httpOk     — 先查 navigator.onLine，再做 HEAD 请求
 *   3. userId     — 与持久化名字库比对
 *      - 当前 = 'unknown' → 页面未渲染用户信息 → FAIL
 *      - 名字库为 'unknown' 或与当前相同 → 写入名字库 → PASS
 *      - 名字不同 → 账号已切换 → FAIL（TODO: 弹窗确认）
 */
async function runPreCommitGuard(): Promise<{ valid: boolean; reason?: string }> {
  // Guard 1: 登录状态
  if (!isLoggedIn()) return { valid: false, reason: '用户已退出登录' };

  // Guard 2: 网络状态（先 onLine 底层，再 HEAD 二次确认）
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
  if (!httpOk) return { valid: false, reason: '网络异常（HTTP 非 200）' };

  // Guard 3: 用户 ID 名字库比对
  const currentName = readCurrentUserId();

  // 当前为 unknown → 页面未正常渲染用户信息，视为异常状态
  if (currentName === 'unknown') {
    return { valid: false, reason: '无法读取用户信息（DOM 用户头像未就绪）' };
  }

  const storedName = await getUserName();

  // 账号切换由 background 负责通知 UI；content 只需同步本地缓存名并放行
  if (storedName !== currentName) {
    await setUserName(currentName);
  }
  return { valid: true };
}

async function doScrape(
  page: 'usage' | 'spending',
  isIncremental: boolean,
  cutoffIso: string | null,
  accountId?: string,
): Promise<void> {
  // ── Step 1: 采集 → 写入临时变量，不直接发往 storage ─────────────────────
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

  // ── Step 2: 提交前三条防线校验 ───────────────────────────────────────────
  // 先检查是否收到取消指令
  if (normalScrapeCancelled) {
    normalScrapeCancelled = false;
    chrome.runtime.sendMessage({
      type: 'SCRAPE_ERROR', error: '手动取消采集', errorType: 'cancelled', page,
    }).catch(() => {});
    return;
  }
  const guard = await runPreCommitGuard();
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
    // 为每条记录打上 accountId 标签（若 accountId 已知）
    const taggedRecords = accountId
      ? usageRecords.map(r => ({ ...r, accountId }))
      : usageRecords;
    chrome.runtime.sendMessage({ type: 'USAGE_DATA', records: taggedRecords, isIncremental }).catch(() => {});
    console.log(`[cursor-stats] usage committed: ${taggedRecords.length} records (incr=${isIncremental}, accountId=${accountId ?? 'n/a'})`);
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
    // spending 页面：等待套餐详情或按需区块渲染，比 main 更精确
    await waitForElement(
      '.dashboard-section, p[class*="font-semibold"], #on-demand-usage',
      12_000,
    ).catch(() => sleep(3_000));
  }

  // 先读取当前登录用户名，随 PAGE_READY 一起发给 background 做账号校验
  const detectedUser = readCurrentUserId();

  // 通知 background 就绪，拿回采集参数
  let params: ScrapeParams | null = null;
  try {
    params = await chrome.runtime.sendMessage({ type: 'PAGE_READY', page, detectedUser }) as ScrapeParams | null;
  } catch {
    // background SW 未响应（极少情况），按全量兜底
  }

  if (params) {
    await doScrape(page, params.isIncremental, params.cutoffIso, params.accountId);
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

      if (msg.type === 'SLOW_SCRAPE_CANCEL') {
        slowScrapeCancelled = true;
        sendResponse({ ok: true });
        return false;
      }

      if (msg.type === 'CANCEL_SCRAPE') {
        normalScrapeCancelled = true;
        sendResponse({ ok: true });
        return false;
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

    // ── 等待 SPA 内容渲染 ────────────────────────────────────────────────────
    try {
      if (page === 'usage') {
        await waitForElement(USAGE_SELECTOR, 20_000);
      } else {
        await waitForElement(
          '.dashboard-section, p[class*="font-semibold"], #on-demand-usage', 12_000,
        ).catch(() => sleep(3_000));
      }
    } catch {
      // 等待超时：按超时错误处理
      chrome.runtime.sendMessage({
        type: 'SCRAPE_ERROR', error: 'scrape timeout (20s)', errorType: 'timeout', page,
      }).catch(() => {});
      return;
    }

    // ── 通知 background 就绪，拿回采集参数 ──────────────────────────────────
    const detectedUser2 = readCurrentUserId();
    let params: ScrapeParams | null = null;
    try {
      params = await chrome.runtime.sendMessage({ type: 'PAGE_READY', page, detectedUser: detectedUser2 }) as ScrapeParams | null;
    } catch {
      // background SW 未响应（极少情况），按全量兜底
    }

    // ── 路由：慢速 hover 采集 vs 正常采集 ───────────────────────────────────
    if (page === 'usage' && params?.slowMode) {
      // 慢速路径：20 分钟硬上限 + 内部 30s stale 检测
      const maxTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('slow scrape timeout (20min)')), SLOW_SCRAPE_MAX_MS),
      );
      try {
        slowScrapeCancelled = false;
        await Promise.race([slowScrapeAllPages(new Set(params?.existingTokenKeys ?? [])), maxTimeout]);
        // Promise.race 正常 resolve（无异常）
        if (!slowScrapeCancelled) {
          // 所有页自然完成，通知 background 写入 storage 并结束
          chrome.runtime.sendMessage({ type: 'SLOW_SCRAPE_ALL_DONE' }).catch(() => {});
        }
        // 若 slowScrapeCancelled=true，说明用户已取消，background 那边已处理，无需再发
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        if (errMsg.includes('context invalidated') || errMsg.includes('Extension context')) return;
        chrome.runtime.sendMessage({
          type: 'SLOW_SCRAPE_PAGE', page: 0, totalPages: 0, rowsUpdated: 0, breakdown: {},
          error: errMsg,
        }).catch(() => {});
      }
    } else {
      // 正常路径：20s 硬超时
      const hardTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('scrape timeout (20s)')), SCRAPE_TIMEOUT_MS),
      );
      try {
        await Promise.race([
          doScrape(page, params?.isIncremental ?? false, params?.cutoffIso ?? null, params?.accountId),
          hardTimeout,
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('context invalidated') || msg.includes('Extension context')) return;
        const errorType = msg.includes('timeout') ? 'timeout' : 'generic';
        chrome.runtime.sendMessage({
          type: 'SCRAPE_ERROR', error: msg, errorType, page,
        }).catch(() => {});
      }
    }
  },
});
