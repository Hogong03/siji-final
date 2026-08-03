/**
 * 本地存储 CRUD 封装（聚合入口）
 *
 * 策略：
 *  - 日记按月份分片 → storage key: diary_YYYY-MM
 *  - 账单按月份分片 → storage key: bill_YYYY-MM
 *  - 计划不分片   → storage key: plan_all
 *  - 所有写操作：先落本地 → 入同步队列
 *  - 软删除：is_deleted=1
 *
 * 本文件为聚合入口，实际实现分布在 storage/ 子模块中。
 * 对外 API 完全不变，调用方无需修改。
 */

// 内部工具函数（各子模块共享）
export { getRawList, getMonthFromDate, getMonthFromDateStr } from './storage/helpers.js'

// 日记
export {
  getDiaryList,
  getDeletedDiaries,
  restoreDiary,
  purgeDiary,
  saveDiary,
  deleteDiary,
  togglePinDiary,
  getDiaryById
} from './storage/diary.js'

// 分类
export {
  getCategories,
  addCategory,
  removeCategory,
  getCategoryIcon
} from './storage/categories.js'

// 账单
export {
  getBillList,
  getDeletedBills,
  restoreBill,
  purgeBill,
  saveBill,
  deleteBill,
  getCategoryBudgets,
  setCategoryBudget,
  getMonthlyBudget,
  setMonthlyBudget,
  getBillTemplates,
  saveBillTemplate,
  deleteBillTemplate
} from './storage/bill.js'

// 计划 & 计划模板
export {
  getPlanTemplates,
  savePlanTemplate,
  deletePlanTemplate,
  ensureDefaultTemplates,
  getPlanList,
  savePlan,
  deletePlan,
  getChildPlans,
  getPlanTree
} from './storage/plan.js'

// 本地索引 & 全局搜索
export {
  rebuildIndex,
  getIndex,
  searchByIndex,
  updateIndex,
  globalSearch
} from './storage/search.js'

// 数据导出
export {
  exportAllData,
  exportJson,
  exportCsv
} from './storage/export.js'

// 体验反馈
export {
  getFeedbackList,
  saveFeedback,
  deleteFeedback,
  updateFeedback,
  getFeedbackStats
} from './storage/feedback.js'

// 标签管理
export {
  getTags,
  getUsedTags,
  addCustomTag,
  removeCustomTag
} from './storage/tags.js'

// 版本历史
export {
  getVersionHistory,
  getVersionRecord,
  addVersionRecord,
  getLatestVersion,
  initVersionHistory
} from './storage/version-history.js'
