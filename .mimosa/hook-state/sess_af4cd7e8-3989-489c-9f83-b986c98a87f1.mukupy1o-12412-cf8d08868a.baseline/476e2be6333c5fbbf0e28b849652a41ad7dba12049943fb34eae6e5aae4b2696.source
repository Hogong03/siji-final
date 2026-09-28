/**
 * 计划「今日一页」纯逻辑（3.4.3 今日行动条）
 *
 * collectDailySuggestions：跨活跃主计划收集「未完成且最小」的子计划
 *  - 3.5.0 起下沉到叶子：主计划 → 阶段容器（有子计划）→ 最小可执行叶子；
 *    容器本身不占位，阶段内叶子（含循环任务）直接上今日条
 *  - 只统计可执行链：主计划与任务都未完成、未冷藏(frozen_at)、未放任意时间(someday_at)
 *  - 循环任务（3.5.0）：daily 当日已打卡即跳过、weekly 本周达标或当日已打卡即跳过；
 *    任务与所属阶段窗口未开始/已结束（start_time/deadline，含祖先）不进今日条
 *  - 每个活跃主计划按 est_minutes 升序出队，多计划轮询直到上限（默认 3 件），避免单计划霸榜
 *  - 无 est_minutes 的历史子计划按 15 分钟参与排序（温和默认，不催不罚）
 *  - 纯函数，不读写存储，页面与测试共用
 */

import { buildPlanIndex, recurTypeOf, recurCountOf, weeklyDoneOf, isCheckedToday, quotaSatisfied, startEndTsOf } from './plan-recur.js'

const DEFAULT_MINUTES = 15

/** 收集并排序今日候选 */
export function collectDailySuggestions(plans, { limit = 3 } = {}) {
  const source = Array.isArray(plans) ? plans.filter(p => p && p.is_deleted !== 1) : []
  const byId = {}
  source.forEach(p => {
    if (p && p.client_id) byId[p.client_id] = p
  })
  const index = buildPlanIndex(source)
  const nowTs = Date.now()
  const now = new Date(nowTs)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1

  /** 收集容器（root/阶段）内所有可执行叶子 */
  function collectLeaves(container, root, out) {
    const kids = source.filter(p => p.parent_id === container.client_id)
    kids.forEach(kid => {
      if (kid.status === 2 || kid.frozen_at || kid.someday_at) return
      const hasKids = source.some(p => p.parent_id === kid.client_id)
      if (hasKids) {
        // 阶段容器：不占位，下沉收集
        collectLeaves(kid, root, out)
        return
      }
      const rt = recurTypeOf(kid)
      // 叶子窗口只约束循环任务：普通任务保留「一直出现直到完成」的原行为
      if (rt) {
        const { startTs, endTs } = startEndTsOf(kid, index)
        if (startTs != null && startTs > todayEnd) return
        if (endTs != null && endTs < todayStart) return
      }
      if (rt === 'daily' && isCheckedToday(kid, nowTs)) return
      if (rt === 'weekly' && (quotaSatisfied(kid, nowTs) || isCheckedToday(kid, nowTs))) return
      const eff = kid.est_minutes > 0 ? Number(kid.est_minutes) : DEFAULT_MINUTES
      out.push({
        client_id: kid.client_id,
        title: kid.title || '',
        est_minutes: kid.est_minutes || 0,
        eff,
        order: kid.created_at || 0,
        sourceId: root.client_id,
        sourceTitle: root.title || '',
        recurType: rt,
        recurText: rt === 'daily' ? '每日循环' : rt === 'weekly' ? ('每周 ' + recurCountOf(kid) + ' 次') : '',
        progressText: rt === 'weekly' ? ('本周 ' + weeklyDoneOf(kid, nowTs) + '/' + recurCountOf(kid)) : ''
      })
    })
  }

  // 每个活跃主计划一个队列，队列内按「约多少分钟」升序
  const groups = new Map()
  source.forEach(root => {
    if (root.parent_id || root.status === 2 || root.frozen_at || root.someday_at) return
    const bucket = []
    collectLeaves(root, root, bucket)
    if (bucket.length === 0) return
    groups.set(root.client_id, bucket)
  })

  const queues = []
  groups.forEach(bucket => {
    bucket.sort((a, b) => (a.eff - b.eff) || (a.order - b.order))
    queues.push(bucket)
  })
  // 根计划排序：先出队「下一步更小」的计划，轮询顺序稳定
  queues.sort((a, b) => (a[0].eff - b[0].eff) || (a[0].order - b[0].order))

  const max = Math.max(1, Math.floor(limit))
  const out = []
  while (out.length < max && queues.length > 0) {
    let took = false
    for (let i = 0; i < queues.length; i++) {
      const bucket = queues[i]
      const item = bucket.shift()
      if (item) {
        out.push(item)
        took = true
        if (out.length >= max) break
      }
      if (bucket.length === 0) {
        queues.splice(i, 1)
        i--
      }
    }
    if (!took) break
  }
  return out.slice(0, max)
}

/** 聚合多条执行事件（打卡 + 完成），按时间倒序 — 执行记录页共用（3.4.3） */
export function collectPlanExecEvents(plans, { max = 300 } = {}) {
  const list = []
  const source = Array.isArray(plans) ? plans.filter(p => p && p.is_deleted !== 1) : []
  source.forEach(p => {
    if (Array.isArray(p.checkins)) {
      p.checkins.forEach(c => {
        if (c && c.at) {
          list.push({
            at: c.at,
            date: c.date || '',
            kind: 'checkin',
            title: p.title || '',
            note: (c.note || '').slice(0, 80),
            planId: p.client_id
          })
        }
      })
    }
    if (Array.isArray(p.executions)) {
      p.executions.forEach(e => {
        if (e && e.action === 'done' && e.at) {
          list.push({
            at: e.at,
            date: '',
            kind: 'done',
            title: p.title || '',
            note: '',
            planId: p.client_id
          })
        }
      })
    }
  })
  list.sort((a, b) => (b.at || 0) - (a.at || 0))
  return list.slice(0, Math.max(1, Math.floor(max)))
}
