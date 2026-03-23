import { useState, useEffect } from 'react';
import { storage } from 'wxt/utils/storage';

export type ThemeMode = 'light' | 'dark' | 'system';

// 独立 storage item，不依赖 F03 的 storage.ts
const themeStorage = storage.defineItem<ThemeMode>('local:themeMode', {
  fallback: 'system',
});

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', resolveMode(mode) === 'dark');
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    // 初始化：从 storage 读取，并立刻应用
    themeStorage.getValue().then((saved) => {
      setModeState(saved);
      applyTheme(saved);
    });

    // 监听系统颜色偏好变化（仅 system 模式下生效）
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMqChange = () => {
      themeStorage.getValue().then((saved) => {
        if (saved === 'system') applyTheme('system');
      });
    };
    mq.addEventListener('change', handleMqChange);
    return () => mq.removeEventListener('change', handleMqChange);
  }, []);

  const setTheme = async (newMode: ThemeMode) => {
    await themeStorage.setValue(newMode);
    setModeState(newMode);
    applyTheme(newMode);
  };

  return { mode, setTheme };
}
