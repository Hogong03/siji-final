/**
 * 记录导出 — 单篇/月度导出为文本
 * J1: 导出分享
 */
import { getDiaryList } from '@/utils/storage.js'

/** 导出单篇记录为文本 */
export function exportDiaryText(diary) {
  const date = new Date(diary.created_at)
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const tags = Array.isArray(diary.tags) ? diary.tags : []
  const lines = [
    `${diary.title || '无标题'}`,
    `${dateStr}`,
    ``,
    diary.content || '',
  ]
  if (tags.length > 0) lines.push(``, `标签: ${tags.join(' / ')}`)
  if (diary.category) lines.push(`分类: ${diary.category}`)
  if (diary.ai_summary) lines.push(``, `AI 摘要: ${diary.ai_summary}`)
  if (diary.ai_advice) lines.push(`AI 建议: ${diary.ai_advice}`)
  return lines.join('\n')
}

/** 导出某月全部记录为文本 */
export function exportMonthText(month) {
  const list = getDiaryList(month)
  if (list.length === 0) return `${month} 暂无记录`
  const lines = [`=== ${month} 记录导出 ===`, `共 ${list.length} 篇`, '']
  list.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
  list.forEach((d, i) => {
    lines.push(`--- ${i + 1} ---`)
    lines.push(exportDiaryText(d))
    lines.push('')
  })
  return lines.join('\n')
}

/** 分享单篇记录 */
export function shareDiary(diary) {
  const text = exportDiaryText(diary)
  // #ifdef APP-PLUS
  plus.share.sendWithSystem({ content: text }, () => {}, (e) => {
    uni.showToast({ title: '分享失败', icon: 'none' })
  })
  // #endif
  // #ifdef H5
  // H5 使用剪贴板
  uni.setClipboardData({ data: text, success: () => uni.showToast({ title: '已复制到剪贴板', icon: 'success' }) })
  // #endif
  // #ifdef MP
  uni.setClipboardData({ data: text, success: () => uni.showToast({ title: '已复制', icon: 'success' }) })
  // #endif
}
