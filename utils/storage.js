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
  getDiaryById,
  getDiariesBetween,
  migrateRecordTypes,
  migrateDiaryCategories,
  RECORD_TYPE_KEYS
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
  getPlanTree,
  convertSubtasksToChildPlans,
  convertPhasesToChildPlans,
  buildChildrenSpecsFromLegacy,
  logPlanCheckIn,
  removePlanCheckIn,
  getPlanCheckInStats,
  getPlanCheckInRecords,
  setPlanFrozen,
  setPlanSomeday,
  setPlanRecur
} from './storage/plan.js'

// 内置种子数据：BKD 项目技术学习手册（4.19.0）；六级种子已下线（清理逻辑见 seed-cleanup.js）
export { ensureBkdHandbook, BKD_ARTICLES, BKD_ARTICLE_IDS, BKD_TAG } from './storage/bkd-handbook.js'
export { removeCet6Content } from './storage/seed-cleanup.js'

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
  exportCsv,
  exportBackup,
  exportBackupJson,
  parseBackup,
  importBackup
} from './storage/export.js'

// 自动本地备份（App 端专属）
export {
  AUTO_BACKUP_SWITCH_KEY,
  AUTO_BACKUP_LAST_KEY,
  AUTO_BACKUP_INTERVAL_MS,
  shouldAutoBackup,
  pickKeepLatest,
  fileNameToTime,
  isAutoBackupEnabled,
  createAutoBackup,
  listAutoBackups,
  restoreAutoBackup,
  runAutoBackup
} from './storage/backup.js'

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
  TAG_ORDER_KEY,
  getTagOrder,
  setTagOrder,
  applyTagOrder,
  moveTagInList,
  addCustomTag,
  removeCustomTag,
  getTagsByCategory,
  updateTagCategory,
  getAllCategories,
  addCustomCategory,
  removeCustomCategory,
  TAG_CATEGORIES
} from './storage/tags.js'

// 微光本（3.4 M2）
export {
  getGlimmers,
  getGlimmerByDate,
  saveGlimmer,
  removeGlimmer,
  countGlimmers,
  todayStr
} from './storage/glimmer.js'

// 版本历史
export {
  getVersionHistory,
  getVersionRecord,
  addVersionRecord,
  getLatestVersion,
  initVersionHistory
} from './storage/version-history.js'
