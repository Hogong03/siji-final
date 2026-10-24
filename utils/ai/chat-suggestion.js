/**
 * chat-suggestion.js — AI 回复后的引导短句（合并 AI suggestions 与本地兜底）
 *
 * 背景：部分厂商（尤其流式纯文本回复）不会在 JSON 里返回 suggestions，
 * 导致 AI 气泡下方的快捷 chips 时有时无。
 *
 * 4.48.0 起规则本体搬到 utils/ai/guide.js（与提示层的「引导三式」同一份事实源），
 * 本文件只保留合并入口，避免两套引导规则各自漂移。
 *
 * 铁律：只生成「用户会直接发出的话」，禁止评价式/催促式/问心情的伪建议
 * （"你觉得呢""要不要试试""感觉怎么样"一类都不允许出现）。
 */
import { pickGuideChips } from './guide.js'

/**
 * 根据回复文本生成兜底建议（引导型短句）
 * @param {string} replyText - AI 最终回复
 * @returns {string[]} 0-2 条短句
 */
export function buildFallbackSuggestions(replyText) {
  return pickGuideChips(replyText)
}

/**
 * 合并建议：AI 给了就用 AI 的（最多 3 条），没给就本地兜底
 * @param {Array} aiList - AI suggestions（可能 undefined）
 * @param {string} replyText - 兜底用的回复文本
 * @returns {string[]}
 */
export function mergeSuggestions(aiList, replyText) {
  const out = []
  const push = (item) => {
    const s = item != null ? String(item).trim() : ''
    if (s && out.indexOf(s) === -1) out.push(s)
  }
  ;(Array.isArray(aiList) ? aiList.slice(0, 3) : []).forEach(push)
  if (out.length > 0) return out.slice(0, 3)
  buildFallbackSuggestions(replyText).forEach(push)
  return out.slice(0, 2)
}
