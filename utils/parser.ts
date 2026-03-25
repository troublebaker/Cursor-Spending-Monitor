/**
 * cursor.com DOM 解析器
 * 最后验证日期：2026-03-25
 * cursor.com 技术栈：React SPA，Next.js，Tailwind 动态类
 * 选择器失效时：优先检查 aria-label 和文本内容（比 class 稳定）
 *
 * 2026-03-25 修正：
 *   - 日期 cell：改用 span[title] 获取含年份的完整时间（如 "Mar 25, 2026, 03:44:09 PM GMT+8"）
 *   - 类型 cell：改用 span[title] 获取完整描述（如 "Included in Ultra"）
 *   - Tokens ：支持中文"万"单位（如 "28.2万" → 282000）
 *   - Cell 选择器：改用 role="cell"（实际 DOM 无 td / data-cell，只有 role 属性）
 */

import type { UsageRecord, SpendingData } from './types';

// ─── 常量 ──────────────────────────────────────────────────────────────────────

const SELECTORS = {
  tableContainer: '.dashboard-table-rows',
  nextBtn: '[aria-label="Next page"]',
  lastBtn: '[aria-label="Last page"]',
  firstBtn: '[aria-label="First page"]',
  paginationText: 'span.mx-2.text-base.font-medium',
} as const;

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function waitForElement(selector: string, timeout = 10_000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const obs = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { obs.disconnect(); resolve(found); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      reject(new Error(`waitForElement timeout: ${selector}`));
    }, timeout);
  });
}

/** 检测是否已登录：未登录时 cursor.com 会重定向到 authenticator.cursor.sh */
export function isLoggedIn(): boolean {
  return !location.hostname.includes('authenticator.cursor.sh')
    && !document.title.toLowerCase().includes('sign in')
    && !document.querySelector('[data-testid="login-button"]');
}

// ─── Usage 页面解析 ────────────────────────────────────────────────────────────

/**
 * 把中文"万"单位的 token 字符串转成数字。
 * "28.2万" → 282000  "1,234" → 1234  "5000" → 5000
 */
function parseTokenCount(text: string): number {
  const wan = text.match(/^([\d.]+)\s*万$/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10_000);
  return parseInt(text.replace(/,/g, ''), 10) || 0;
}

/**
 * 解析费用字符串。
 * 支持格式：
 *   "$0.0234"       → 0.0234
 *   "US$0.04"       → 0.04   （cursor.com 实际格式，带 ISO 货币代码前缀）
 *   "HK$0.04"       → 0.04
 *   "Included…"     → 0
 *   "—" / "-" / ""  → 0
 */
function parseCostValue(text: string): number {
  if (!text || text === '—' || text === '-') return 0;
  if (text.toLowerCase().startsWith('included')) return 0;
  // 移除货币代码前缀（0-3 个大写字母）+ "$"，再移除千位逗号
  // 例：US$0.04 → 0.04 ; $0.0234 → 0.0234 ; HK$1,234.56 → 1234.56
  const cleaned = text.replace(/[A-Za-z]{0,3}\$/g, '').replace(/,/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * 从 index 4 起扫描，找含 "$" 的费用单元格（支持 "US$"/"$" 等前缀）或以 "included" 开头的格。
 * cursor.com 实际费用格式为 "US$0.04"，contains('$') 比 startsWith('$') 更健壮。
 */
function findCostCell(cells: Element[]): string {
  for (let i = 4; i < cells.length; i++) {
    const text = cells[i].textContent?.trim() ?? '';
    if (text.includes('$') || text.toLowerCase().startsWith('included')) {
      return text;
    }
  }
  // 降级：返回 index 4 的原始文本（向后兼容）
  return cells[4]?.textContent?.trim() ?? '';
}

export function parseRow(row: Element): UsageRecord | null {
  // 真实 DOM 用 role="cell"（不是 td / data-cell）
  const cells = Array.from(row.querySelectorAll('[role="cell"]'));

  // 降级：无 role 属性时退回到子元素顺序
  const effectiveCells = cells.length >= 5
    ? cells
    : Array.from(row.children);

  if (effectiveCells.length < 5) return null;

  // ── Cell 0: 日期 ──
  // textContent 只有 "Mar 25, 03:44 PM"（无年份），title 有 "Mar 25, 2026, 03:44:09 PM GMT+8"
  const dateSpan = effectiveCells[0].querySelector('span[title]');
  const rawDt = dateSpan?.getAttribute('title') ?? effectiveCells[0].textContent?.trim() ?? '';

  // 忽略表头行
  if (!rawDt || rawDt.toLowerCase().includes('date') || rawDt.toLowerCase().includes('时间')) return null;

  // 尝试解析为 ISO；失败时保留原始字符串
  const parsedDate = new Date(rawDt);
  const dt = isNaN(parsedDate.getTime()) ? rawDt : parsedDate.toISOString();

  // ── Cell 1: 类型 ──
  // textContent = "Included"，title = "Included in Ultra" / "On-Demand" 等
  const typeSpan = effectiveCells[1].querySelector('span[title]');
  const type = typeSpan?.getAttribute('title') ?? effectiveCells[1].textContent?.trim() ?? '';

  // ── Cell 2: 模型 ──
  const modelSpan = effectiveCells[2].querySelector('span[title]');
  const model = modelSpan?.getAttribute('title') ?? effectiveCells[2].textContent?.trim() ?? '';

  // ── Cell 3: Tokens（支持"万"单位） ──
  const tokensStr = effectiveCells[3].textContent?.trim() ?? '';
  const tokens = parseTokenCount(tokensStr);

  // ── Cell 4+: 费用（扫描找含 $ 或 Included 的单元格，兼容新增列） ──
  const costStr = findCostCell(effectiveCells);
  const cost = parseCostValue(costStr);
  // 保留原始字符串用于展示（如 "US$0.04"），空/横线/Included 不保留
  const costRaw = costStr && costStr !== '—' && costStr !== '-' && !costStr.toLowerCase().startsWith('included')
    ? costStr
    : undefined;

  if (!type || !model) return null;

  return { dt, type, model, tokens, cost, costRaw };
}

/**
 * 点击 30d 时间范围按钮（若当前未激活则点击，并等待表格刷新）
 */
export async function click30dFilter(): Promise<void> {
  const buttons = document.querySelectorAll('.dashboard-segmented-control-option');
  const btn = Array.from(buttons).find(
    b => b.textContent?.trim() === '30d',
  ) as HTMLButtonElement | null;
  if (!btn) return;
  if (btn.classList.contains('dashboard-segmented-control-option-active')) return;
  btn.click();
  // 等待 SPA 刷新表格数据
  await sleep(1_200);
}

export async function scrapeAllPages(): Promise<UsageRecord[]> {
  const all: UsageRecord[] = [];

  while (true) {
    await waitForElement(SELECTORS.tableContainer);
    await sleep(500);

    document.querySelectorAll(`${SELECTORS.tableContainer} > *`).forEach(row => {
      const r = parseRow(row);
      if (r) all.push(r);
    });

    const next = document.querySelector(SELECTORS.nextBtn) as HTMLButtonElement | null;
    if (!next || next.getAttribute('aria-disabled') === 'true') break;
    next.click();
    await sleep(800);
  }

  return all;
}

export async function scrapeIncremental(cutoffDt: Date): Promise<UsageRecord[]> {
  const newRecs: UsageRecord[] = [];

  pageLoop: while (true) {
    await waitForElement(SELECTORS.tableContainer);
    await sleep(500);

    let allOld = true;
    document.querySelectorAll(`${SELECTORS.tableContainer} > *`).forEach(row => {
      const r = parseRow(row);
      if (!r) return;
      if (new Date(r.dt) > cutoffDt) {
        newRecs.push(r);
        allOld = false;
      }
    });

    // 当前页所有记录都比 cutoff 旧，提前退出翻页
    if (allOld) break pageLoop;

    const next = document.querySelector(SELECTORS.nextBtn) as HTMLButtonElement | null;
    if (!next || next.getAttribute('aria-disabled') === 'true') break;
    next.click();
    await sleep(800);
  }

  return newRecs;
}

// ─── Spending 页面解析 ─────────────────────────────────────────────────────────
// 使用 document.body.innerText 全文正则，不依赖 class 名或元素结构
// 基于真实数据验证（Ultra 计划，$200/mo，2026-03-23）

/**
 * 可在任意上下文调用（包括测试面板），接受页面 innerText 字符串。
 * parseSpending() 是其对 cursor.com 页面的包装。
 */
export function parseSpendingFromText(raw: string): SpendingData {

  // 套餐名：按优先级匹配，Ultra 最先（避免被 Pro 前缀误匹配）
  const planNames = ['Ultra', 'Pro+', 'Business', 'Pro', 'Free'];
  const planName = planNames.find(n => new RegExp(`\\b${n}\\b`).test(raw)) ?? 'Unknown';

  // 套餐价格：支持 "$200/mo" 和 "$20/month"
  const priceMatch = raw.match(/\$([\d,]+)\/mo(?:nth)?/i);
  const planPrice = priceMatch ? `$${priceMatch[1]}/mo` : '';

  // 重置日期：如 "Resets on 4月22日 (31 days)"
  const resetMatch = raw.match(/Resets on (.+?)(?:\n|$)/i);
  const resetDate = resetMatch ? resetMatch[1].trim() : '';

  // Total%：支持合并格式 "Total0%" 和分开格式 "Total 5%"
  const totalMatch = raw.match(/Total\s*(\d+(?:\.\d+)?)%/i);
  const totalPct = totalMatch ? parseFloat(totalMatch[1]) : 0;

  // Auto/API%：真实格式 "0% Auto and 1% API used"
  const autoApiMatch = raw.match(/(\d+(?:\.\d+)?)%\s+Auto\s+and\s+(\d+(?:\.\d+)?)%\s+API/i);
  // 降级：分别找标签附近的 %
  const autoPct = autoApiMatch
    ? parseFloat(autoApiMatch[1])
    : (raw.match(/Auto[^%]*?(\d+(?:\.\d+)?)%/i)?.[1] ? parseFloat(raw.match(/Auto[^%]*?(\d+(?:\.\d+)?)%/i)![1]) : 0);
  const apiPct = autoApiMatch
    ? parseFloat(autoApiMatch[2])
    : (raw.match(/API[^%]*?(\d+(?:\.\d+)?)%/i)?.[1] ? parseFloat(raw.match(/API[^%]*?(\d+(?:\.\d+)?)%/i)![1]) : 0);

  // 按需用量：支持格式 "On-Demand$0.00 / $200" 和 "$0.00 / $200"
  const demandMatch = raw.match(/\$([\d.]+)\s*\/\s*\$([\d,]+)/);
  let demandUsed  = 0;
  let demandLimit = 50;
  if (demandMatch) {
    demandUsed  = parseFloat(demandMatch[1]);
    demandLimit = parseFloat(demandMatch[2].replace(/,/g, ''));
  }

  return {
    scrapedAt: new Date().toISOString(),
    planName,
    planPrice,
    resetDate,
    totalPct,
    autoPct,
    apiPct,
    demandUsed,
    demandLimit,
    // monthlyLimitMode / monthlyLimitAmount 由 parseSpending() DOM 版本补充
    monthlyLimitMode: undefined,
    monthlyLimitAmount: undefined,
  };
}

/** cursor.com spending 页面直接调用的包装：读取当前页面 innerText，并补充 DOM 解析数据 */
export function parseSpending(): SpendingData {
  const data = parseSpendingFromText(document.body.innerText ?? '');
  // 月用量上限需要读取 DOM 元素（button 文本、input value），innerText 无法可靠提取
  const onDemand = parseOnDemandInfo(document);
  if (onDemand) {
    data.monthlyLimitMode   = onDemand.mode ?? undefined;
    data.monthlyLimitAmount = onDemand.amount ?? null;
  }
  return data;
}

// ─── 用户信息解析（姓名 + 套餐） ───────────────────────────────────────────────

/**
 * 从 cursor.com/(locale)/dashboard/... 侧边栏提取用户姓名和套餐名称。
 *
 * DOM 结构（已通过真实 HTML 验证 2026-03-25）：
 * <div class="flex min-w-0 flex-1 flex-col items-start gap-0">
 *   <div class="flex ...">
 *     <span class="truncate text-base font-medium">Fancy James</span>   ← name
 *   </div>
 *   <span class="... text-sm text-secondary">Ultra</span>               ← plan
 * </div>
 */
export function parseUserInfo(doc: Document): { name: string; plan: string } | null {
  const nameEl = doc.querySelector<HTMLElement>('span.truncate.text-base.font-medium');
  if (!nameEl) return null;

  // plan span 是上层 flex-col 容器的直接子 <span>（紧跟 name 父 div 之后）
  const infoCol = nameEl.closest<HTMLElement>('[class*="flex-col"][class*="items-start"]');
  const planEl  = infoCol
    ? Array.from(infoCol.children).find(
        el => el.tagName === 'SPAN' && el !== nameEl.parentElement,
      )
    : null;

  return {
    name: nameEl.textContent?.trim() ?? '',
    plan: planEl?.textContent?.trim() ?? '',
  };
}

// ─── Spending 页面解析（Tests 1 & 3） ─────────────────────────────────────────

/**
 * Test 1：解析 "Current Plan" 区块 — 套餐名称、价格、重置日期。
 *
 * HTML 结构（spending 页，2026-03-25 验证）：
 * <div class="...text-tertiary uppercase...">Current Plan</div>
 * <div class="flex items-baseline gap-2 mb-1">
 *   <p class="...text-lg font-semibold text-primary">Ultra</p>          ← plan
 *   <p class="...text-base text-secondary">$200/mo</p>                   ← price
 * </div>
 * <p class="...text-base text-secondary mt-1 flex-grow">Resets on ...</p> ← reset
 */
export function parseSpendingPlanInfo(doc: Document): {
  plan: string; price: string; resetText: string;
} | null {
  const planEl  = doc.querySelector<HTMLElement>('p[class*="text-lg"][class*="font-semibold"]');
  if (!planEl) return null;
  // Price: sibling p in the same "items-baseline" flex row, before the mt-1 reset line
  const priceEl = planEl.parentElement?.querySelector<HTMLElement>('p[class*="text-base"]:not([class*="mt-1"])');
  // Reset: the p that has both mt-1 and flex-grow
  const resetEl = doc.querySelector<HTMLElement>('p[class*="mt-1"][class*="flex-grow"]');
  return {
    plan:      planEl.textContent?.trim() ?? '',
    price:     priceEl?.textContent?.trim() ?? '',
    resetText: resetEl?.textContent?.trim() ?? '',
  };
}

/**
 * Test 3：解析 "On-Demand Usage" 区块 — 用量金额 + Monthly Limit 配置。
 *
 * On-demand value: 靠近 #on-demand-usage header 的第一个 span.font-medium.text-primary
 * Mode button: button[aria-haspopup="true"] 内文本（Fixed/Unlimited/Disabled）
 * Amount input: input[type="number"] 的 value（Fixed 模式下才有意义）
 */
export function parseOnDemandInfo(doc: Document): {
  displayText: string;
  usedDollars: number;
  limitDollars: number;
  mode: string;
  amount: number | null;
} | null {
  const header  = doc.querySelector<HTMLElement>('#on-demand-usage');
  if (!header) return null;
  const section = header.closest<HTMLElement>('.dashboard-section');

  const valueEl     = section?.querySelector<HTMLElement>('span.font-medium.text-primary');
  const displayText = valueEl?.textContent?.trim() ?? '';
  const parts       = displayText.split('/').map(s => s.replace(/[$,\s]/g, ''));
  const usedDollars  = parseFloat(parts[0] ?? '0') || 0;
  const limitDollars = parseFloat(parts[1] ?? '0') || 0;

  const modeBtn = doc.querySelector<HTMLButtonElement>('button[aria-haspopup="true"]');
  const rawMode = (modeBtn?.textContent ?? '').trim();
  const mode    = (['Fixed', 'Unlimited', 'Disabled'] as const).find(m => rawMode.startsWith(m)) ?? rawMode;

  const amountInput = doc.querySelector<HTMLInputElement>('input[type="number"]');
  const amount      = amountInput ? (parseInt(amountInput.value, 10) || null) : null;

  return { displayText, usedDollars, limitDollars, mode, amount };
}
