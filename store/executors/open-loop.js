/**
 * 开放事项 executor（M2.3）
 * 只做两件事：查未闭环、按用户明确指令改状态/标题/进度。
 * 不提供 create —— 写入必须走对话内联确认卡（utils/open-loops.js 的 createFromCandidate）。
 */
import {
  getAllLoops,
  getLoopsByStatus,
  getLoopById,
  transitionLoop,
  updateLoopFields
} from '@/utils/open-loops.js'
import { canTransition } from '@/utils/open-loops.js'

const STATUS_LABEL = { open: '进行中', paused: '已暂停', done: '已完成', dropped: '已放下' }

function resolveLoop(p) {
  const id = p && (p.id || p.loop_id)
  if (id) {
    const hit = getLoopById(id)
    if (hit) return { loop: hit }
    return { error: '没找到这条事项（id 可能已变）' }
  }
  const title = String((p && p.title) || '').trim()
  if (!title) return { error: '需要 id 或 title' }
  const hits = getAllLoops().filter((l) => String(l.title || '').includes(title))
  if (hits.length === 1) return { loop: hits[0] }
  if (hits.length > 1) return { error: `匹配到 ${hits.length} 条，请先确认是哪一条` }
  return { error: '没找到这条事项' }
}

export function createOpenLoopExecutors() {
  function execQueryOpenLoops(p) {
    const status = (p && p.status) || 'open'
    const limit = Math.min(Math.max(Number(p && p.limit) || 20, 1), 50)
    let items = status === 'all' ? getAllLoops() : getLoopsByStatus(status)
    const kind = p && p.kind
    if (kind) items = items.filter((l) => l.kind === kind)
    const keyword = String((p && p.keyword) || '').trim()
    if (keyword) items = items.filter((l) => String(l.title || '').includes(keyword) || String(l.next_hint || '').includes(keyword))
    items = items.sort((a, b) => (b.last_at || 0) - (a.last_at || 0)).slice(0, limit)
    return {
      success: true,
      message: items.length ? `有 ${items.length} 件${STATUS_LABEL[status] || ''}的事` : '没有记录在案的事项',
      detail: {
        type: 'query_open_loops',
        status,
        count: items.length,
        items: items.map((l) => ({
          id: l.id,
          title: l.title,
          kind: l.kind,
          status: l.status,
          next_hint: l.next_hint || '',
          days: Math.max(0, Math.floor((Date.now() - (l.last_at || 0)) / 86400000))
        }))
      }
    }
  }

  function execUpdateOpenLoop(p) {
    const found = resolveLoop(p)
    if (found.error) return { success: false, message: found.error, detail: null }
    const loop = found.loop
    const to = p && p.status
    if (to) {
      if (to === loop.status) {
        return { success: true, message: `「${loop.title}」已经是${STATUS_LABEL[to]}`, detail: { type: 'open_loop', id: loop.id, status: to, unchanged: true } }
      }
      if (!canTransition(loop.status, to)) {
        return { success: false, message: `不能从「${STATUS_LABEL[loop.status]}」直接改成「${STATUS_LABEL[to]}」`, detail: null }
      }
      const r = transitionLoop(loop.id, to)
      if (!r.ok) return { success: false, message: '状态没改成，请重试', detail: null }
      return { success: true, message: `「${loop.title}」已标记为${STATUS_LABEL[to]}`, detail: { type: 'open_loop', id: loop.id, status: to } }
    }

    const patch = {}
    if (p && p.title) patch.title = p.title
    if (p && typeof p.next_hint === 'string') patch.next_hint = p.next_hint
    if (p && p.plan_id) patch.plan_id = p.plan_id
    if (!Object.keys(patch).length) return { success: false, message: '没有要改的内容', detail: null }
    const r = updateLoopFields(loop.id, patch)
    if (!r.ok) return { success: false, message: '修改失败', detail: null }
    return { success: true, message: `「${r.loop.title}」已更新`, detail: { type: 'open_loop', id: loop.id, updated: Object.keys(patch) } }
  }

  return { execQueryOpenLoops, execUpdateOpenLoop }
}
