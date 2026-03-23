import type { LocaleDict } from '../utils/i18n/zh-CN';
import type { SupportedLang } from '../utils/i18n';
import { detectBrowserLang } from '../utils/i18n';

interface Props {
  t: LocaleDict;
  lang: SupportedLang | '';
  onLangChange: (lang: SupportedLang) => void;
  onStart: () => void;
}

const LANG_OPTIONS: { value: SupportedLang; label: string }[] = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en',    label: 'English' },
];

const FEATURES = (t: LocaleDict) => [
  { icon: '📊', text: t.welcomeFeature1 },
  { icon: '🔄', text: t.welcomeFeature2 },
  { icon: '🔒', text: t.welcomeFeature3 },
];

export function WelcomePage({ t, lang, onLangChange, onStart }: Props) {
  // '' 表示跟随浏览器，解析出实际显示语言用于高亮选择器
  const activeLang: SupportedLang = lang === '' ? detectBrowserLang() : lang;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-10 bg-white dark:bg-zinc-900">

      {/* 语言选择器（顶部，浏览器语言预选） */}
      <div className="flex gap-2 mb-8 self-end">
        {LANG_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onLangChange(value)}
            className={[
              'px-3 py-1 text-xs rounded-full border transition-colors',
              activeLang === value
                ? 'bg-brand border-brand text-white font-semibold'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-brand hover:text-brand',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 图标 */}
      <div className="w-16 h-16 mb-5 rounded-2xl bg-brand flex items-center justify-center shadow-lg">
        <span className="text-3xl select-none">📈</span>
      </div>

      {/* 标题 */}
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">
        {t.appTitle}
      </h1>

      {/* 副标题 */}
      <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-8 leading-relaxed">
        {t.welcomeDesc}
      </p>

      {/* 功能列表 */}
      <ul className="w-full mb-8 space-y-3">
        {FEATURES(t).map(({ icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-base shrink-0">
              {icon}
            </span>
            {text}
          </li>
        ))}
      </ul>

      {/* 开始按钮 */}
      <button
        onClick={onStart}
        className="w-full py-3 bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
      >
        {t.welcomeStart}
      </button>

      {/* 隐私说明 */}
      <p className="mt-5 text-xs text-zinc-400 dark:text-zinc-600 text-center leading-relaxed">
        {t.welcomePrivacy}
      </p>
    </div>
  );
}
