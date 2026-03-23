/**
 * 所有 UI 文字的类型契约。
 * 新增语言包时必须实现此接口的全部字段。
 */
export interface LocaleDict {
  // 通用
  appTitle: string;
  loading: string;
  noData: string;
  // 主题切换
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  // 语言切换
  langZh: string;
  langEn: string;
  // F03 摘要卡片
  monthlyCost: string;
  monthlyCalls: string;
  lastUpdated: string;
  // F03 额度
  quotaUsage: string;
  quotaUsed: string;
  quotaLimit: string;
  resetOn: string;
  // F03 图表标题
  dailyCalls: string;
  dailyCost: string;
  topModels: string;
  detailTable: string;
  planDetail: string;
  // F03 图表内容
  onDemand: string;
  included: string;
  callCount: string;
  costUsd: string;
  // F03 表格列
  colDate: string;
  colType: string;
  colModel: string;
  colTokens: string;
  colCost: string;
  // F04 欢迎页
  welcomeDesc: string;
  welcomeFeature1: string;
  welcomeFeature2: string;
  welcomeFeature3: string;
  welcomeStart: string;
  welcomePrivacy: string;
  // F04 Tab 关闭提醒
  tabClosedBanner: string;
  tabClosedDesc: string;
  tabClosedReopen: string;
  tabClosedNoRemind: string;
  // F04 未登录提示
  loginRequired: string;
  loginRequiredDesc: string;
  loginOpen: string;
  loginNote: string;         // 登录后采集自动恢复
  // F04 采集状态栏
  scrapeModeAuto: string;
  scrapeModeManual: string;
  scrapeNow: string;
  statusCollecting: string;
  statusIdle: string;
  statusWaiting: string;
  nextUpdate: string;
}

const dict: LocaleDict = {
  appTitle: 'Cursor Stats',
  loading: '正在加载数据…',
  noData: '暂无数据',
  themeLight: '浅色',
  themeDark: '深色',
  themeSystem: '跟随系统',
  langZh: '中文',
  langEn: 'English',
  monthlyCost: '本月按需费用',
  monthlyCalls: '本月调用',
  lastUpdated: '最近更新',
  quotaUsage: '额度使用',
  quotaUsed: '已用',
  quotaLimit: '额度',
  resetOn: '重置日期',
  dailyCalls: '每日调用次数',
  dailyCost: '每日费用趋势',
  topModels: '模型分布 Top 12',
  detailTable: '明细记录',
  planDetail: '套餐详情',
  onDemand: '按需',
  included: '包含',
  callCount: '次',
  costUsd: 'USD',
  colDate: '日期',
  colType: '类型',
  colModel: '模型',
  colTokens: 'Tokens',
  colCost: '费用',
  // F04
  welcomeDesc: '自动采集 Cursor.com 用量与费用，完全本地存储',
  welcomeFeature1: '用量与账单实时统计',
  welcomeFeature2: '后台定时采集，指数衰减节省资源',
  welcomeFeature3: '数据存储本地，开源透明',
  welcomeStart: '开始采集',
  welcomePrivacy: '数据仅存储在本地浏览器 · 开源项目',
  tabClosedBanner: '采集标签页已关闭',
  tabClosedDesc: '重新打开后台标签页以继续自动采集',
  tabClosedReopen: '重新打开',
  tabClosedNoRemind: '不再提示',
  loginRequired: '请先登录 Cursor',
  loginRequiredDesc: '未检测到登录状态，请登录后继续',
  loginOpen: '打开 Cursor 登录页',
  loginNote: '登录成功后，数据采集将自动恢复',
  scrapeModeAuto: '自动',
  scrapeModeManual: '手动',
  scrapeNow: '立即采集',
  statusCollecting: '采集中…',
  statusIdle: '空闲',
  statusWaiting: '等待登录',
  nextUpdate: '下次',
};

export default dict;
