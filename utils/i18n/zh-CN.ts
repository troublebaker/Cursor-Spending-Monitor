/**
 * 所有 UI 文字的类型契约。
 * 新增语言包时必须实现此接口的全部字段。
 */
export interface LocaleDict {
  // 通用
  appTitle: string;
  loading: string;
  // 主题切换
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  // TODO: F03 新增仪表盘文字后在此扩展
}

const dict: LocaleDict = {
  appTitle: 'Cursor Stats',
  loading: '正在加载数据…',
  themeLight: '浅色',
  themeDark: '深色',
  themeSystem: '跟随系统',
};

export default dict;
