import { useState, useEffect } from 'react';
import { storage } from 'wxt/utils/storage';
import type { LocaleDict } from './zh-CN';
export type { LocaleDict };

import zh from './zh-CN';
import en from './en';

export type SupportedLang = 'zh-CN' | 'en';

/** 已注册的语言包，新增语言只需加一行 */
const LOCALES: Record<string, LocaleDict> = {
  'zh':    zh,
  'zh-CN': zh,
  'zh-TW': zh,
  'en':    en,
};

/** 语言偏好持久化，'' 表示跟随浏览器 */
const langStorage = storage.defineItem<SupportedLang | ''>('local:langOverride', {
  fallback: '',
});

/** 读取浏览器默认语言（可由组件直接调用） */
export function detectBrowserLang(): SupportedLang {
  try {
    const l = chrome.i18n.getUILanguage();
    if (LOCALES[l]) return l as SupportedLang;
    const prefix = l.split('-')[0];
    if (LOCALES[prefix]) return prefix as SupportedLang;
  } catch { /* 非插件环境降级 */ }
  return 'en';
}

function resolveDict(lang: SupportedLang | ''): LocaleDict {
  const key = lang || detectBrowserLang();
  return LOCALES[key] ?? en;
}

/**
 * useI18n() — 响应式语言管理。
 * 返回 { t, lang, setLang }
 *   t       — 当前语言字典，直接用 t.loading
 *   lang    — 当前语言 key（'zh-CN' | 'en' | ''=auto）
 *   setLang — 切换语言并持久化到 chrome.storage.local
 */
export function useI18n() {
  const [lang, setLangState] = useState<SupportedLang | ''>('');
  const [dict, setDict] = useState<LocaleDict>(() => resolveDict(''));

  useEffect(() => {
    langStorage.getValue().then((saved) => {
      setLangState(saved);
      setDict(resolveDict(saved));
    });
    // 监听其他组件实例切换语言时的 storage 变化
    const unwatch = langStorage.watch((newLang) => {
      const v = newLang ?? '';
      setLangState(v);
      setDict(resolveDict(v));
    });
    return () => unwatch();
  }, []);

  const setLang = async (newLang: SupportedLang | '') => {
    await langStorage.setValue(newLang);
    setLangState(newLang);
    setDict(resolveDict(newLang));
  };

  return { t: dict, lang, setLang };
}

/** 向后兼容的简版 hook（仅返回字典，无法切换） */
export function useT(): LocaleDict {
  return resolveDict('');
}
