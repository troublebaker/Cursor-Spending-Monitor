import type { LocaleDict } from './zh-CN';
export type { LocaleDict };

import zh from './zh-CN';
import en from './en';

/** 已注册的语言包，新增语言只需加一行 */
const LOCALES: Record<string, LocaleDict> = {
  'zh': zh,
  'zh-CN': zh,
  'zh-TW': zh,
  'en': en,
};

/** 根据浏览器 UI 语言选出最合适的语言包 */
function detectDict(): LocaleDict {
  let lang = 'en';
  try {
    lang = chrome.i18n.getUILanguage();
  } catch {
    // 非插件环境（如测试）降级到英文
  }
  return LOCALES[lang] ?? LOCALES[lang.split('-')[0]] ?? en;
}

// 模块加载时确定一次，运行期间不变
const _dict = detectDict();

/**
 * useT() — 返回当前语言的文字字典。
 * 同步，无 loading 状态，直接在 JSX 里解构使用：
 *   const t = useT();  →  <p>{t.loading}</p>
 */
export function useT(): LocaleDict {
  return _dict;
}
