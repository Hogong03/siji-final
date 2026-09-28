/**
 * 微光本 executor（3.4 M2）
 * 轻量领域：直接落 utils/storage/glimmer.js，无索引/无撤销栈/无软删
 */
import { getGlimmers, saveGlimmer, removeGlimmer, todayStr } from '@/utils/storage.js'

export function createGlimmerExecutors() {
  function execCreateGlimmer(p) {
    const content = String((p && p.content) || '').trim().slice(0, 300)
    if (!content) return { success: false, message: '微光内容为空', detail: null }
    const rec = saveGlimmer(content, { date: p && p.date })
    if (!rec) return { success: false, message: '保存失败', detail: null }
    return {
      success: true,
      message: '已收进微光本',
      detail: { type: 'glimmer', date: rec.date, content: rec.content }
    }
  }

  function execQueryGlimmers(p) {
    const days = p && p.days ? Math.min(Math.max(Number(p.days) || 30, 1), 365) : 30
    const minDate = todayStr(-(days - 1))
    const all = getGlimmers()
    const items = all.filter(g => g.date >= minDate)
    return {
      success: true,
      message: items.length > 0 ? '近 ' + days + ' 天有 ' + items.length + ' 条微光' : '微光本是空的，允许空着',
      detail: { type: 'query_glimmers', days, count: items.length, items }
    }
  }

  function execDeleteGlimmer(p) {
    const date = p && (p.date || p.id)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return { success: false, message: '缺少日期', detail: null }
    }
    removeGlimmer(date)
    return { success: true, message: '已删除', detail: { type: 'glimmer', date, deleted: true } }
  }

  return { execCreateGlimmer, execQueryGlimmers, execDeleteGlimmer }
}
