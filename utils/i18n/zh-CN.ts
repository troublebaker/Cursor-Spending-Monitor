/**
 * 所有 UI 文字的类型契约。
 * 新增语言包时必须实现此接口的全部字段。
 */
export interface LocaleDict {
  // 通用
  appTitle: string;
  loading: string;
  noData: string;
  clickUpdateToStart: string;
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
  dailyTokens: string;
  detailTable: string;
  planDetail: string;
  // F05 新增 section 标题
  sectionPlan: string;
  sectionDemand: string;
  // F03 图表内容
  onDemand: string;
  included: string;
  callCount: string;
  costUsd: string;
  total: string;           // "合计"
  callsUnit: string;       // "次"
  // F03 表格列
  colDate: string;
  colType: string;
  colModel: string;
  colTokens: string;
  colCost: string;
  // 图表 & Token 明细
  noTokenData: string;     // 无 tokenBreakdown 数据提示
  tokenDataNote: string;   // 仅含已采集行的备注
  // 相对时间
  justNow: string;
  minutesAgo: string;      // "%d分钟前" / "%d min ago"
  hoursAgo: string;        // "%d小时前" / "%d h ago"
  // InboxPanel
  inboxSubtitle: string;
  inboxClear: string;
  inboxEmpty: string;
  // VersionModal（关于页）
  aboutTitle: string;
  aboutDesc: string;
  aboutGitHub: string;
  // ShareMenu
  shareMenuTitle: string;
  shareText: string;
  shareGitHub: string;
  shareX: string;
  shareReddit: string;
  shareCopy: string;
  shareCopied: string;
  // 社交按钮 Tooltip（header）
  followTooltip: string;
  feedbackTooltip: string;
  emailCopied: string;
  langTooltip: string;
  themeTooltip: string;
  // StatusBar Tooltip 文本
  modeTooltipAuto: string;
  modeTooltipCalm: string;
  modeTooltipManual: string;
  tokenTip: string;
  scrapeWithTokenTip: string;
  abortTooltip: string;
  clearDataTooltip: string;
  clearConfirmTooltip: string;
  // StatusBar 错误文本
  errorLogout: string;
  errorTimeout: string;
  errorCancelled: string;
  // CSV 导出
  exportCsv: string;
  // 账号管理
  accountSelector: string;    // 下拉框 label
  accountAll: string;         // "全部账号"
  accountTooltip: string;     // 悬浮说明：不同账号数据严格隔离
  accountWrongAbort: string;  // 采集中途账号不符，中止提示
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
  scrapeModeAutoCalm: string;
  scrapeModeManual: string;
  scrapeNow: string;
  scrapeNowWithToken: string;
  statusCollecting: string;
  statusIdle: string;
  statusWaiting: string;
  nextUpdate: string;
  // F04 采集进度阶段（StatusBar 进度条）
  stagePage: string;
  stageUsage: string;
  stageSpending: string;
  scrapeNoNew: string;
  scrapeFailed: string;
  scrapeNewRecords: string;  // 单位词，如 "新记录"
  // Debug Panel
  debugTitle: string;
  debugRecords: string;
  debugFirstDt: string;
  debugCurrentMonth: string;
  debugMonthRecords: string;
  debugSpending: string;
  debugNoSpending: string;
  debugClearData: string;
  debugClearConfirm: string;
  debugCopyJson: string;
  debugCopied: string;
}

const dict: LocaleDict = {
  appTitle: 'Cursor Spending Monitor',
  loading: '正在加载数据…',
  noData: '暂无数据',
  clickUpdateToStart: '点击「更新数据」开始采集',
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
  dailyTokens: '每日 Token 用量',
  detailTable: '明细记录',
  planDetail: '套餐详情',
  sectionPlan: '套餐 & 配额',
  sectionDemand: '按需 & 月限',
  onDemand: '按需',
  included: '包含',
  callCount: '次',
  costUsd: 'USD',
  total: '合计',
  callsUnit: '次',
  colDate: '日期',
  colType: '类型',
  colModel: '模型',
  colTokens: 'Tokens',
  colCost: '费用',
  noTokenData: '暂无 Token 明细数据\n请先点击「更新数据+Token」进行采集',
  tokenDataNote: '仅显示已采集 Token 明细的记录',
  justNow: '刚刚',
  minutesAgo: '分钟前',
  hoursAgo: '小时前',
  inboxSubtitle: 'Token 采集',
  inboxClear: '清空',
  inboxEmpty: '暂无消息，通过「更新数据+Token」按钮开始采集',
  aboutTitle: '插件信息 / 关于',
  aboutDesc: '读取 cursor.com 消费账单，本地可视化消费趋势与 Token 明细。无需 API Key，100% 本地运行，不收集任何数据。',
  aboutGitHub: '在 GitHub 查看源码',
  shareMenuTitle: '分享 Cursor Spending Monitor',
  shareText: '推荐免费开源插件 Cursor Spending Monitor！本地可视化 Cursor 消费账单，无需 API Key',
  shareGitHub: '访问 GitHub 仓库',
  shareX: '分享到 X / Twitter',
  shareReddit: '分享到 Reddit',
  shareCopy: '复制链接',
  shareCopied: '链接已复制！',
  followTooltip: '快来关注我吧 👋\n@CodeJames333025 on X',
  feedbackTooltip: '反馈 / 联系\ncodejames971@gmail.com\n点击复制邮箱',
  emailCopied: '已复制邮箱到剪贴板 ✓',
  langTooltip: '切换语言 / Language',
  themeTooltip: '切换主题 / Theme',
  modeTooltipAuto: '自动活跃：每 1 分钟查询一次\n无新数据则指数衰减，最长 60 分钟\n点击「更新数据」可重置间隔',
  modeTooltipCalm: '自动冷静：每 5 分钟查询一次\n无新数据则指数衰减，最长 60 分钟\n点击「更新数据」可重置间隔',
  modeTooltipManual: '手动模式：不自动查询\n仅在点击「更新数据」时采集',
  tokenTip: '勾选后每次自动采集完成\n同时采集 Token 输入/输出明细\n已有数据的行跳过，增量更新\n每页约 2~3 分钟，后台完成',
  scrapeWithTokenTip: '先普通采集，再逐行悬停\n读取 Token 输入/输出明细\n已有数据的行跳过（增量）\n每页约 2~3 分钟，后台完成',
  abortTooltip: '中止本次采集并丢弃数据',
  clearDataTooltip: '清空所有记录',
  clearConfirmTooltip: '再次点击确认\n清空所有记录',
  exportCsv: '导出 CSV',
  // 账号管理
  accountSelector: '账号',
  accountAll: '全部账号',
  accountTooltip: '不同账号数据严格隔离\n切换账号仅显示该账号数据\n采集时自动匹配当前登录账号',
  accountWrongAbort: '账号不匹配，本次采集已中止',
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
  scrapeModeAuto: '自动活跃',
  scrapeModeAutoCalm: '自动冷静',
  scrapeModeManual: '手动',
  scrapeNow: '更新数据',
  scrapeNowWithToken: '更新数据+Token',
  statusCollecting: '采集中…',
  statusIdle: '空闲',
  statusWaiting: '等待登录',
  nextUpdate: '下次',
  stagePage: '正在打开采集页…',
  stageUsage: '正在采集用量记录…',
  stageSpending: '正在采集账单信息…',
  scrapeNoNew: '已是最新',
  scrapeFailed: '采集失败',
  scrapeNewRecords: '条新记录',
  // Debug Panel
  debugTitle: '调试 / 数据检查',
  debugRecords: '条记录',
  debugFirstDt: '最新记录时间',
  debugCurrentMonth: '当前月份',
  debugMonthRecords: '本月记录数',
  debugSpending: '账单信息',
  debugNoSpending: '暂无',
  debugClearData: '清除所有数据',
  debugClearConfirm: '确认清除？此操作不可恢复',
  debugCopyJson: '复制 JSON',
  debugCopied: '已复制',
  // StatusBar 错误文本
  errorLogout: '✗ 已登出，数据已丢弃',
  errorTimeout: '✗ 已超时（15s），数据已丢弃',
  errorCancelled: '✗ 已中止采集',
};

export default dict;
