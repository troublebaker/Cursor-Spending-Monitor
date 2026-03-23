import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  // 禁止 pnpm dev 自动开新 Chrome，改用主 Chrome Load unpacked → .output/chrome-mv3
  // 这样主 Chrome 里的插件能连上 dev server，background 变更才能自动 reload
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'Cursor Stats',
    description: 'Track your Cursor.com API usage & spending — fully local',
    version: '0.1.0',
    permissions: ['storage', 'alarms', 'tabs', 'sidePanel', 'notifications'],
    host_permissions: [
      'https://cursor.com/*',
      'https://www.cursor.com/*',
    ],
    action: { default_title: 'Cursor Stats' },
    side_panel: { default_path: 'sidepanel.html' },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '96': 'icon/96.png',
      '128': 'icon/128.png',
    },
  },
});
