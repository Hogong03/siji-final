/**
 * 本周焦点 executor（4.27.0）—— 轻量领域：直接落 utils/week-focus.js
 */
import { setWeekFocus, getWeekFocus } from '@/utils/week-focus.js'

export function createWeekFocusExecutors() {
  function execSetWeekFocus(p) {
    const text = String((p && p.text) || '').trim().slice(0, 60)
    if (!text) return { success: false, message: '焦点内容为空', detail: null }
    const rec = setWeekFocus(text)
    if (!rec) return { success: false, message: '保存失败', detail: null }
    return {
      success: true,
      message: '已定下本周焦点：「' + rec.text + '」',
      detail: { type: 'week_focus', text: rec.text, weekKey: rec.weekKey }
    }
  }

  function execGetWeekFocus() {
    const rec = getWeekFocus()
    if (!rec || !rec.isCurrent) {
      return { success: true, message: '本周还没定焦点', detail: { type: 'week_focus', current: false } }
    }
    return {
      success: true,
      message: '本周焦点：「' + rec.text + '」',
      detail: { type: 'week_focus', current: true, text: rec.text, weekKey: rec.weekKey }
    }
  }

  return { execSetWeekFocus, execGetWeekFocus }
}
