/**
 * chat-ruler — 对话尺纯逻辑（3.5.17）
 *
 * 对话够长时在聊天区左侧出现一条竖向刻度尺，用于快速跳转：
 *  - 刻度锚点 = 用户消息（用户消息过少时退化为全部消息）
 *  - 刻度位置 = 消息序号在会话中的占比（不测量 DOM 高度，零查询开销）
 *  - 视口指示 = scrollTop / scrollHeight 的真实比例（精确反映当前位置）
 *  - 跳转 = 先把虚拟窗口扩到目标消息，再交给 scroll-into-view
 *
 * 本文件只有纯函数（便于单测）；滚动与触摸编排在 composables/useChatRuler.js
 */

export const RULER_MIN_MESSAGES = 20      // 消息数达到该值才显示对话尺
export const RULER_MAX_TICKS = 28         // 最多刻度数，超出按比例降采样
export const RULER_MIN_ANCHORS = 6        // 用户消息锚点少于该值时退化为全部消息
export const RULER_PREVIEW_LEN = 18       // 预览文案截断长度
export const RULER_JUMP_INTERVAL = 120    // 拖动时两次跳转的最小间隔（ms）
export const RULER_MIN_VIEWPORT = 6       // 视口指示最小高度（百分比）
export const RULER_KEEP_ABOVE = 5         // 跳转后目标消息上方保留的条数

/** 消息数是否够长到需要对话尺 */
export function shouldShowRuler(messageCount, min) {
  const count = Number(messageCount)
  if (!Number.isFinite(count)) return false
  const floor = Number.isFinite(Number(min)) ? Number(min) : RULER_MIN_MESSAGES
  return count >= floor
}

/** 刻度预览文案：压平空白 + 截断 + 省略号；图片消息没有正文时给占位 */
export function summarizeMessage(msg, len) {
  if (!msg) return ''
  const max = Number.isFinite(Number(len)) ? Number(len) : RULER_PREVIEW_LEN
  const raw = String(msg.content || '').split(/\s+/).join(' ').trim()
  if (!raw) return msg.image ? '[图片]' : ''
  return raw.length > max ? raw.slice(0, max) + '…' : raw
}

/** 等距降采样：首尾必留，中间按比例取点 */
function _downsample(list, maxTicks) {
  const out = []
  const step = (list.length - 1) / (maxTicks - 1)
  for (let i = 0; i < maxTicks; i++) {
    const picked = list[Math.round(i * step)]
    if (out.indexOf(picked) === -1) out.push(picked)
  }
  return out
}

/**
 * 生成刻度
 * @param {Array} messages 全量消息
 * @param {Object} options maxTicks / minAnchors / previewLen
 * @returns {Array<{key, messageIndex, role, label, percent}>}
 */
export function buildRulerTicks(messages, options) {
  const list = Array.isArray(messages) ? messages : []
  const total = list.length
  if (total === 0) return []
  const opt = options || {}
  const maxTicks = Math.max(2, Number.isFinite(Number(opt.maxTicks)) ? Number(opt.maxTicks) : RULER_MAX_TICKS)
  const minAnchors = Math.max(1, Number.isFinite(Number(opt.minAnchors)) ? Number(opt.minAnchors) : RULER_MIN_ANCHORS)

  let anchors = []
  for (let i = 0; i < total; i++) {
    if (list[i] && list[i].role === 'user') anchors.push(i)
  }
  if (anchors.length < minAnchors) {
    anchors = []
    for (let i = 0; i < total; i++) anchors.push(i)
  }
  if (anchors.length > maxTicks) anchors = _downsample(anchors, maxTicks)

  const span = total > 1 ? total - 1 : 1
  return anchors.map(function (index) {
    const msg = list[index]
    const percent = total > 1 ? (index / span) * 100 : 50
    return {
      key: 't' + index,
      messageIndex: index,
      role: (msg && msg.role) === 'user' ? 'user' : 'assistant',
      label: summarizeMessage(msg, opt.previewLen),
      percent: Math.round(percent * 100) / 100
    }
  })
}

/** 视口指示：滚动位置换算成刻度尺上的 top / height 百分比 */
export function viewportRange(scrollTop, scrollHeight, clientHeight) {
  const total = Number(scrollHeight) || 0
  const view = Number(clientHeight) || 0
  const top0 = Number(scrollTop) || 0
  if (total <= 0 || view <= 0 || view >= total) return { top: 0, height: 100 }
  const height = Math.max(RULER_MIN_VIEWPORT, (view / total) * 100)
  const range = total - view
  const ratio = range <= 0 ? 0 : Math.min(1, Math.max(0, top0 / range))
  return { top: ratio * (100 - height), height }
}

/** 取离给定百分比最近的刻度 */
export function pickTickByPercent(ticks, percent) {
  const list = Array.isArray(ticks) ? ticks : []
  if (list.length === 0) return null
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  let best = list[0]
  let gap = Math.abs(best.percent - p)
  for (let i = 1; i < list.length; i++) {
    const cur = Math.abs(list[i].percent - p)
    if (cur < gap) {
      best = list[i]
      gap = cur
    }
  }
  return best
}

/** 取离当前视口顶部最近的刻度（滚动时高亮用） */
export function pickTickByScroll(ticks, scrollTop, scrollHeight, clientHeight) {
  const range = viewportRange(scrollTop, scrollHeight, clientHeight)
  return pickTickByPercent(ticks, range.top)
}

/** 触摸点纵坐标 → 刻度尺百分比（rect 为刻度尺的 boundingClientRect） */
export function percentFromY(clientY, rect) {
  if (!rect || !(rect.height > 0)) return 0
  const y = Number(clientY)
  if (!Number.isFinite(y)) return 0
  const ratio = (y - rect.top) / rect.height
  return Math.min(100, Math.max(0, ratio * 100))
}

/**
 * 跳转需要的虚拟窗口条数
 * 目标消息不在当前窗口内时，扩到「目标上方保留 keepAbove 条」为止；够用就不动
 */
export function resolveWindowSize(globalIndex, total, visibleCount, keepAbove) {
  const count = Math.max(0, Number(total) || 0)
  const current = Math.max(0, Number(visibleCount) || 0)
  const index = Number(globalIndex)
  if (!Number.isFinite(index) || index < 0 || index >= count) return current
  const keep = Number.isFinite(Number(keepAbove)) ? Math.max(0, Number(keepAbove)) : RULER_KEEP_ABOVE
  const start = Math.max(0, index - keep)
  return Math.min(count, Math.max(current, count - start))
}