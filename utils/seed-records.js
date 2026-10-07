/**
 * 内置种子记录判定
 *
 * 背景：内置的种子记录直接写进用户记录库，用户在记录列表 / 阅读页 / 搜索结果里
 * 分不清哪些是内置内容 —— 这里统一判定，各页面共用。
 *
 * 前缀来源（实际 grep 自种子文件，勿凭记忆改）：
 *   - utils/storage/bkd-handbook.js  → bkdh_（4 篇：bkdh_read_path/tech_stack/prereq/learning_path）
 *   （4.19.0：六级种子 tip_cet6_ / mat_cet6_ 已下线，记录由 seed-cleanup.js 软删，
 *     历史软删记录不再需要徽标）
 *
 * 纯函数、无副作用；新增种子来源时在 SEED_CLIENT_ID_PREFIXES 里扩前缀即可。
 */

/** 内置种子记录的 client_id 前缀 */
const SEED_CLIENT_ID_PREFIXES = ['bkdh_']

/** 徽标文案（记录列表 / 阅读页 / 搜索结果页共用） */
export const SEED_BADGE = '内置'

/**
 * 判定一条记录是否为内置种子内容
 * @param {object} item 记录对象（至少带 client_id；搜索结果项可传 { client_id: item.id }）
 * @returns {boolean}
 */
export function isSeedRecord(item) {
  const id = item && item.client_id
  if (typeof id !== 'string' || !id) return false
  return SEED_CLIENT_ID_PREFIXES.some(prefix => id.indexOf(prefix) === 0)
}
