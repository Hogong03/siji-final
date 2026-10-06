/**
 * 内置种子记录判定
 *
 * 背景：3.8.0 起内置的六级技巧 / 复习资料等种子记录直接写进用户记录库，
 * 用户在记录列表 / 阅读页 / 搜索结果里分不清哪些是内置内容 —— 这里统一判定，各页面共用。
 *
 * 前缀来源（实际 grep 自种子文件，勿凭记忆改）：
 *   - utils/storage/cet6-tips.js     → tip_cet6_（4 条：tip_cet6_ch_writing/listening/reading/translation）
 *   - utils/storage/cet6-material.js → mat_cet6_（6 条：mat_cet6_vocab/writing/translation/listening/reading/flow）
 *
 * 纯函数、无副作用；新增种子来源时在 SEED_CLIENT_ID_PREFIXES 里扩前缀即可。
 */

/** 内置种子记录的 client_id 前缀 */
const SEED_CLIENT_ID_PREFIXES = ['tip_cet6_', 'mat_cet6_']

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
