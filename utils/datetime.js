/**
 * 日期时间解析与格式化工具
 */

/** 解析 "YYYY-MM-DD HH:mm:ss" 或 "YYYY-MM-DD" 为 { date, time } */
export function parseDateTime(str) {
  if (!str) return { date: '', time: '' }
  const m = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)?/)
  if (m) {
    return { date: m[1], time: m[2] || '' }
  }
  return { date: str, time: '' }
}

/** 合并日期和时间为 "YYYY-MM-DD HH:mm" */
export function combineDateTime(date, time) {
  if (!date) return ''
  if (!time) return date
  const parts = time.split(':')
  const h = parts[0] || '00'
  const m = parts[1] || '00'
  return `${date} ${h.padStart(2, '0')}:${m.padStart(2, '0')}`
}
