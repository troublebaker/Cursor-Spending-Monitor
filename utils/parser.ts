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
// 全程使用正则匹配文本，不依赖 class 名（cursor.com Tailwind 类会随构建变化）

export function parseSpending(): SpendingData {
  const allText = Array.from(document.querySelectorAll('span, div, p, h1, h2, h3'))
    .map(el => el.textContent?.trim() ?? '')
    .filter(t => t.length > 0);

  // 套餐名：常见值 "Pro" | "Pro+" | "Business"
  const planNames = ['Pro+', 'Business', 'Pro', 'Free'];
  const planName = planNames.find(n => allText.some(t => t === n)) ?? 'Unknown';

  // 套餐价格：匹配 "$20/month" 或 "$20 / month"
  const priceMatch = allText.find(t => /\$\d+\s*\/\s*month/i.test(t));
  const planPrice = priceMatch?.match(/\$[\d.]+\s*\/\s*month/i)?.[0] ?? '';

  // 重置日期：格式多样，取含月日的字符串
  const resetMatch = allText.find(t => /next\s+reset|resets?\s+on/i.test(t));
  const resetDate = resetMatch?.replace(/next\s+reset[:\s]*/i, '').trim()
    ?? allText.find(t => /\d{4}-\d{2}-\d{2}/.test(t))
    ?? '';

  // 各用量百分比：通过相邻标签定位
  const autoPct = extractPctByLabel(allText, ['Auto', 'Autocomplete']);
  const apiPct  = extractPctByLabel(allText, ['API']);
  const totalPct = extractPctByLabel(allText, ['Total', 'Overall']) ?? Math.round((autoPct ?? 0) + (apiPct ?? 0));

  // 按需用量："$X.XX" 或 "$X of $Y"
  const demandMatch = allText.find(t => /\$[\d.]+\s+of\s+\$[\d.]+/.test(t));
  let demandUsed = 0;
  let demandLimit = 50; // Pro 默认 $50

  if (demandMatch) {
    const nums = demandMatch.match(/\$([\d.]+)\s+of\s+\$([\d.]+)/);
    if (nums) {
      demandUsed  = parseFloat(nums[1]);
      demandLimit = parseFloat(nums[2]);
    }
  } else {
    // 降级：从 "Your plan includes at least $X" 提取上限
    const limitText = allText.find(t => /includes\s+at\s+least\s+\$[\d.]+/.test(t));
    if (limitText) {
      const m = limitText.match(/\$([\d.]+)/);
      if (m) demandLimit = parseFloat(m[1]);
    }
    // 按需已用：单独的 "$X.XX" 出现在进度条附近
    const usedText = allText.find(t => /^\$[\d.]+$/.test(t) && parseFloat(t.slice(1)) <= demandLimit);
    if (usedText) demandUsed = parseFloat(usedText.slice(1));
  }

  return {
    scrapedAt: new Date().toISOString(),
    planName,
    planPrice,
    resetDate,
    totalPct: totalPct ?? 0,
    autoPct: autoPct ?? 0,
    apiPct: apiPct ?? 0,
    demandUsed,
    demandLimit,
  };
}

/** 在文本列表中，找到 label 后紧接的百分比 */
function extractPctByLabel(texts: string[], labels: string[]): number | undefined {
  for (let i = 0; i < texts.length; i++) {
    if (labels.some(l => texts[i].toLowerCase().includes(l.toLowerCase()))) {
      // 向后搜索最近的百分比（最多 3 个位置）
      for (let j = i + 1; j <= i + 3 && j < texts.length; j++) {
        const m = texts[j].match(/^([\d.]+)\s*%$/);
        if (m) return parseFloat(m[1]);
      }
    }
  }
  return undefined;
}
