/**
 * cursor.com DOM 解析器
 * 最后验证日期：2026-03-03
 * cursor.com 技术栈：React SPA，Next.js，Tailwind 动态类
 * 选择器失效时：优先检查 aria-label 和文本内容（比 class 稳定）
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

export function parseRow(row: Element): UsageRecord | null {
  // 优先：data-cell 或 td
  const cells = row.querySelectorAll('[data-cell], td');
  const parts = cells.length >= 5
    ? Array.from(cells).map(c => c.textContent?.trim() ?? '')
    : Array.from(row.children).map(c => c.textContent?.trim() ?? '');

  if (parts.length < 5) return null;

  const [dt, type, model, tokensStr, costStr] = parts;

  // 忽略表头行
  if (dt.toLowerCase().includes('date') || dt.toLowerCase().includes('时间')) return null;

  return {
    dt,
    type,
    model,
    tokens: parseInt(tokensStr.replace(/,/g, ''), 10) || 0,
    cost: parseFloat(costStr.replace(/[$,]/g, '')) || 0,
  };
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

export function parseSpending(): SpendingData {
  const raw = document.body.innerText ?? '';

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
  };
}



