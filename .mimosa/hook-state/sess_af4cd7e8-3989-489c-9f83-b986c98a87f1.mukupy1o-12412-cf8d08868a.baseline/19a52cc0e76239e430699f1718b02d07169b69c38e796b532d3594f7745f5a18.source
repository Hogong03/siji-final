/**
 * 长期记忆管理（门面文件，3.5.14 拆分）
 *
 * 设计：
 *   memories: [{ id, content, category, createdAt, updatedAt }]
 *   category: fact(事实) | preference(偏好) | event(事件) | summary(摘要) | other
 *
 * 存储：siji_long_term_memory
 *
 * 原 692 行单文件按职责拆到 utils/memory/ 目录，本文件只做转出，旧引用一律可用：
 *   store.js           CRUD + 记忆开关 + 过期清理
 *   normalize.js       文本归一化（去重与治理共用）
 *   governance.js      合并 / 隐藏 / 删除 / 分类修正
 *   context.js         注入系统提示词的记忆摘要
 *   profile-values.js  画像字段值（过滤冗余记忆）
 *   profile-link.js    记忆采纳进画像
 *   monthly.js         月度记忆卡
 *   auto-extract.js    对话后提取 + AI 摘要
 */

export {
  getAllMemories,
  getMemoriesByCategory,
  addMemory,
  updateMemory,
  deleteMemory,
  clearAllMemories,
  getMemoryStats,
  isMemoryEnabled,
  setMemoryEnabled
} from './memory/store.js'

export { normalizeMemoryText } from './memory/normalize.js'

export {
  findDuplicateGroups,
  findStaleAdoptedMemories,
  suggestMemoryCategory,
  applyGovernance,
  restoreHiddenMemory
} from './memory/governance.js'

export { buildMemoryContext } from './memory/context.js'

export {
  suggestProfileAdoption,
  adoptMemoryToProfile,
  getAdoptableMemories,
  getUnadoptedMemories,
  integrateMemoriesToProfile,
  markMemoriesAdoptedByProfile
} from './memory/profile-link.js'

export {
  getMonthlyMemoryCards,
  appendToMonthlyCard,
  buildMonthlyMemoryContext
} from './memory/monthly.js'

export { autoExtractMemory, aiSummarizeConversation } from './memory/auto-extract.js'
