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
  // TODO: F04 新增采集状态文字后在此扩展
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
};

export default dict;
