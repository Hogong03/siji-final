/**
 * 计划 & 计划模板 CRUD
 *
 * 存储策略：不分片 → storage key: plan_all / plan_template_all
 */

import { getRawList } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'
import {
  buildPlanIndex,
  recurTypeOf,
  recurCountOf,
  weeklyDoneOf,
  calcCheckinStreak,
  shouldAutoCompleteRecurring,
  collectCascadeCompletions,
  normalizeRecur
} from '../plan-recur.js'

// ==================== 计划状态收敛（3.5.0 循环任务 / 3.5.1 级联收尾） ====================

/**
 * 读取计划列表时惰性收敛状态，只写一次：
 *  1. 循环窗口整体已结束的循环任务 → 自动收尾
 *  2. 直接子计划全部结束的父级（阶段 / 主计划）→ 级联收尾
 */
function reconcilePlanStatus(list) {
  const raw = JSON.parse(JSON.stringify(list)) // 防御：不改调用方引用
  const byId = buildPlanIndex(raw)
  let changed = false
  const nowTs = Date.now()
  raw.forEach(item => {
    if (!item || item.is_deleted === 1) return
    if (!shouldAutoCompleteRecurring(item, byId, nowTs)) return
    item.status = 2
    item.done_at = nowTs
    item.executions = pushExecLog(item.executions, 'done')
    changed = true
  })
  const cascadeIds = collectCascadeCompletions(raw)
  if (cascadeIds.length > 0) {
    const pending = new Set(cascadeIds)
    raw.forEach(item => {
      if (!pending.has(item.client_id)) return
      item.status = 2
      item.done_at = nowTs
      item.executions = pushExecLog(item.executions, 'done')
      changed = true
    })
  }
  if (changed) asyncSetStorageJSON(PLAN_KEY, raw)
  return raw
}

// ==================== 计划模板 ====================

const TEMPLATE_KEY = 'plan_template_all'

/** 获取所有计划模板 */
export function getPlanTemplates() {
  const raw = uni.getStorageSync(TEMPLATE_KEY)
  if (!raw) return []
  try { return JSON.parse(raw).filter(t => t.is_deleted !== 1) }
  catch { return [] }
}

/** 保存/更新计划模板 */
export function savePlanTemplate(tpl) {
  const list = getRawList(TEMPLATE_KEY)
  const idx = list.findIndex(t => t.client_id === tpl.client_id)
  tpl.updated_at = Date.now()
  if (idx >= 0) list[idx] = { ...list[idx], ...tpl }
  else list.push(tpl)
  asyncSetStorageJSON(TEMPLATE_KEY, list)
  return tpl
}

/** 软删除计划模板 */
export function deletePlanTemplate(clientId) {
  const list = getRawList(TEMPLATE_KEY)
  const idx = list.findIndex(t => t.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 1
    list[idx].updated_at = Date.now()
    asyncSetStorageJSON(TEMPLATE_KEY, list)
  }
}

/** 预置默认模板（首次启动时调用） */
export function ensureDefaultTemplates() {
  // 3.5.0：按 client_id 增量补发内置模板（老用户也能拿到新增的六级备考）
  const existingIds = new Set(getPlanTemplates().map(t => t.client_id))
  const defaults = [
    {
      client_id: 'tpl_fitness', name: '健身计划', icon: '🏃', color: '#E8A838',
      description: '每周运动4次，逐步提升体能',
      plan_data: { priority: 2, subtasks: [
        { title: '周一：有氧40分钟' }, { title: '周三：力量训练40分钟' },
        { title: '周五：有氧+核心30分钟' }, { title: '周日：拉伸放松30分钟' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_reading', name: '阅读计划', icon: '📚', color: '#18181B',
      description: '每月读完2本书，养成阅读习惯',
      plan_data: { priority: 1, subtasks: [
        { title: '选书并购买/借阅' }, { title: '每天阅读30分钟' },
        { title: '做读书笔记' }, { title: '写读后感' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_travel', name: '旅行准备', icon: '✈️', color: '#4A7C59',
      description: '旅行前完整准备清单',
      plan_data: { priority: 2, subtasks: [
        { title: '确定目的地和日期' }, { title: '预订机票和酒店' },
        { title: '制定行程攻略' }, { title: '准备行李清单' }, { title: '检查证件有效期' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_study', name: '考试备考', icon: '🎓', color: '#D35D5D',
      description: '系统备考计划，分阶段复习',
      plan_data: { priority: 3, subtasks: [
        { title: '收集考试大纲和教材' }, { title: '制定每日学习时间表' },
        { title: '第一轮：通读教材' }, { title: '第二轮：专题练习' },
        { title: '第三轮：模拟考试' }, { title: '考前冲刺复习' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_cet6', name: '六级备考', icon: '🎓', color: '#D35D5D', category: 'study',
      description: '三段式六级备考：唤醒 30 天 → 强化 40 天 → 冲刺 22 天（约 93 天）',
      plan_data: {
        priority: 2,
        tags: ['备考', '六级'],
        deadline_offset_days: 93,
        subtasks: [
          {
            title: '唤醒期（约前 30 天）',
            description: '目标：找回语感、扫清单词障碍。做法：每天 50 个高频词 + 精翻 1 篇仔细阅读 + 真题听力跟读 30 分钟。完成标准：听力跟得上脚本，阅读生词明显减少。',
            start_offset_days: 0,
            end_offset_days: 30,
            children: [
              {
                title: '背高频词 50 个（只记意思）',
                description: '用词表或 App 过 50 个高频词，只认意思不背拼写；不会的标出来，第二天先复习。',
                est_minutes: 20, recur_type: 'daily'
              },
              {
                title: '精翻 1 篇仔细阅读',
                description: '做 1 篇仔细阅读后逐句精翻全文，把生词和长难句抄在旁边搞懂为止。',
                est_minutes: 40, recur_type: 'daily'
              },
              {
                title: '真题听力跟读 30 分钟',
                description: '放真题音频，看着脚本跟读 30 分钟，不做题、不追求听懂，先练耳朵（铁律一：每天必听）。',
                est_minutes: 30, recur_type: 'daily'
              }
            ]
          },
          {
            title: '强化期（第 31-71 天）',
            description: '目标：阅读冲 160、听力冲 170。做法：每天 30 词复习 + 2 篇仔细阅读 + 1 篇段落匹配 + 1 套真题听力分析；每周背 1 篇作文模板。完成标准：仔细阅读计时完成，听力错题能说清错因。',
            start_offset_days: 31,
            end_offset_days: 71,
            children: [
              {
                title: '背高频词 30 个（复习为主）',
                description: '新词 30 个 + 复习唤醒期标出的生词，只认意思；单词只欠每日小额，不整块时间。',
                est_minutes: 20, recur_type: 'daily'
              },
              {
                title: '2 篇仔细阅读 + 1 篇段落匹配',
                description: '计时做完并分析错因；仔细阅读是提分大头，错题标注题型（细节/主旨/推断）。',
                est_minutes: 60, recur_type: 'daily'
              },
              {
                title: '1 套真题听力（对答案分析）',
                description: '完整做 1 套听力并对答案，分析错因，错得多的 section 重听一遍。',
                est_minutes: 40, recur_type: 'daily'
              },
              {
                title: '背 1 篇作文模板',
                description: '每周背 1 篇作文模板并默写一遍；宁写简单句不写错句（铁律三）。',
                est_minutes: 30, recur_type: 'weekly', recur_count: 1
              }
            ]
          },
          {
            title: '冲刺期（第 72-93 天）',
            description: '目标：稳定心态、确保过线。做法：每周 3 次完整模考（严格计时）+ 每天复习错题生词 + 每周默写作文模板。完成标准：模考稳定过线，考前状态不慌。',
            start_offset_days: 72,
            end_offset_days: 93,
            children: [
              {
                title: '完整模考（严格计时）',
                description: '每周 3 次完整模考，严格计时；考后复盘错题。铁律二：选词填空直接蒙，时间留给仔细阅读。',
                est_minutes: 120, recur_type: 'weekly', recur_count: 3
              },
              {
                title: '复习错题与生词',
                description: '过一遍所有模考错题与生词，只过不会的，不恋战。',
                est_minutes: 30, recur_type: 'daily'
              },
              {
                title: '默写作文模板',
                description: '手写默写作文模板，练字迹与速度；考前一天再默一遍。',
                est_minutes: 20, recur_type: 'weekly', recur_count: 1
              }
            ]
          }
        ]
      },
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_habit', name: '早起习惯', icon: '🌅', color: '#F5A623',
      description: '21天养成早起习惯',
      plan_data: { priority: 1, subtasks: [
        { title: '设定每天6:30闹钟' }, { title: '早睡：23:00前入睡' },
        { title: '起床后喝一杯水' }, { title: '晨间10分钟拉伸' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    }
  ]
  defaults.forEach(t => { if (!existingIds.has(t.client_id)) savePlanTemplate(t) })
}

// ==================== 计划 ====================

const PLAN_KEY = 'plan_all'

/** 获取所有计划（不含已删除） */
export function getPlanList() {
  const raw = uni.getStorageSync(PLAN_KEY)
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    return reconcilePlanStatus(Array.isArray(list) ? list : []).filter(item => item.is_deleted !== 1)
  } catch {
    return []
  }
}

/** 追加执行日志（3.3 A：完成动作入账，最多保留最近 50 条） */
function pushExecLog(executions, action) {
  const list = Array.isArray(executions) ? executions.slice() : []
  list.push({ action, at: Date.now() })
  return list.slice(-50)
}

/** 保存/更新计划（3.3 A：status 由非完成态切到 2 时自动写 done_at + 执行日志，UI 与 AI executor 共用此入口） */
export function savePlan(plan) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === plan.client_id)
  plan.updated_at = Date.now()
  if (idx >= 0) {
    const old = list[idx]
    const next = { ...old, ...plan }
    if (next.status === 2 && old.status !== 2) {
      next.done_at = Date.now()
      next.executions = pushExecLog(next.executions, 'done')
    }
    list[idx] = next
  } else {
    plan.executions = plan.executions || []
    list.push(plan)
  }
  asyncSetStorageJSON(PLAN_KEY, list)
  return plan
}

/**
 * 计划打卡（3.4.1 B：今日做了，轻记录）
 * 只追加 checkins，不动 status/plan_count/executions/done_at，也不刷 updated_at（打卡不是规划事件）；
 * 同一自然日幂等（同 date 覆盖，同日再打视为补写 note）；note=这次做了什么（可空）
 * 冷藏/已完成计划禁打卡；最多保留最近 500 条
 * 3.5.4：dateStr 可选（'YYYY-MM-DD'）用于温和补记，只接受过去与今天，非法/未来日期回落到今天
 */
export function logPlanCheckIn(clientId, note, dateStr) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx < 0) return null
  const record = list[idx]
  if (record.is_deleted === 1 || record.frozen_at || record.status === 2) return null
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
  const wanted = typeof dateStr === 'string' ? dateStr.trim() : ''
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(wanted) && wanted <= today
  const date = valid ? wanted : today
  const checkins = Array.isArray(record.checkins) ? record.checkins.filter(c => c && c.date !== date) : []
  const noteText = typeof note === 'string' ? note.trim() : ''
  checkins.push({ date: date, at: now.getTime(), note: noteText })
  checkins.sort((a, b) => (a.at || 0) - (b.at || 0))
  record.checkins = checkins.slice(-500)
  asyncSetStorageJSON(PLAN_KEY, list)
  return record
}

/**
 * 撤销某天的打卡（3.5.6：补记必须可撤，否则一次误触就是永久脏数据）
 * 只删 checkins 里那个日期的一条，不动 executions（完成日志是另一回事）
 * dateStr 必须是 YYYY-MM-DD；计划不存在或那天本来就没打卡返回 null
 */
export function removePlanCheckIn(clientId, dateStr) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx < 0) return null
  const record = list[idx]
  const date = typeof dateStr === 'string' ? dateStr.trim() : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const checkins = Array.isArray(record.checkins) ? record.checkins : []
  const next = checkins.filter(c => c && c.date !== date)
  if (next.length === checkins.length) return null
  record.checkins = next
  asyncSetStorageJSON(PLAN_KEY, list)
  return record
}

/** 计划打卡统计（纯函数：累计天数/最近日期/今日是否已打） */
export function getPlanCheckInStats(plan) {
  const checkins = Array.isArray(plan && plan.checkins) ? plan.checkins : []
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
  const dates = [...new Set(checkins.map(c => c && c.date).filter(Boolean))]
  dates.sort()
  return {
    days: dates.length,
    lastDate: dates.length ? dates[dates.length - 1] : '',
    todayDone: dates.indexOf(today) >= 0,
    streak: calcCheckinStreak(plan),
    weeklyDone: weeklyDoneOf(plan)
  }
}


/**
 * 打卡明细（3.4.1 B2：倒序最近 N 条，供详情页轻列表展示）
 * 每条含 date/at/timeText/note/isToday
 */
export function getPlanCheckInRecords(plan, limit) {
  const checkins = Array.isArray(plan && plan.checkins) ? plan.checkins : []
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 10
  return [...checkins]
    .filter(c => c && c.at)
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, max)
    .map(c => {
      const d = new Date(c.at)
      const pad2 = n => String(n).padStart(2, '0')
      const timeText = Number.isNaN(d.getTime()) ? '' : pad2(d.getHours()) + ':' + pad2(d.getMinutes())
      return { date: c.date || '', at: c.at, timeText: timeText, note: c.note || '', isToday: (c.date || '') === today }
    })
}

/**
 * 冷藏/解冻计划（3.4 M3：先放一放）
 * 只标记 frozen_at，不动 status/executions/plan_count，也不刷新 updated_at（冷藏不是规划事件）；
 * 解冻后计划原样回来。
 */
export function setPlanFrozen(clientId, frozen) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx < 0) return null
  const record = list[idx]
  record.frozen_at = frozen ? Date.now() : null
  asyncSetStorageJSON(PLAN_KEY, list)
  return record
}

/**
 * 任意时间（3.4.3：今天不做，温和顺延）
 * 只标记 someday_at，不动 status/checkins/executions/plan_count，也不刷新 updated_at（顺延不是规划事件）；
 * someday_at 的子计划不进入「今日行动条」，也不显示逾期压力；安排到今天（someday=false）原样回来。
 */
export function setPlanSomeday(clientId, someday) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx < 0) return null
  const record = list[idx]
  record.someday_at = someday ? Date.now() : null
  asyncSetStorageJSON(PLAN_KEY, list)
  return record
}

/**
 * 设置计划的循环属性（3.5.2：详情页 / 子计划卡内联编辑循环设置）
 * 只改 recur_type / recur_count 与 updated_at；不动状态、执行日志与打卡记录
 */
export function setPlanRecur(clientId, recurType, recurCount) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx < 0) return null
  const next = { ...list[idx], ...normalizeRecur(recurType, recurCount), updated_at: Date.now() }
  list[idx] = next
  asyncSetStorageJSON(PLAN_KEY, list)
  return next
}

/** 软删除计划 */
export function deletePlan(clientId) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 1
    list[idx].updated_at = Date.now()
    // 级联软删除所有子计划
    const children = list.filter(item => item.parent_id === clientId && item.is_deleted !== 1)
    children.forEach(child => {
      child.is_deleted = 1
      child.updated_at = Date.now()
    })
    asyncSetStorageJSON(PLAN_KEY, list)
  }
}

/** 获取子计划列表 */
export function getChildPlans(parentId) {
  const raw = uni.getStorageSync(PLAN_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted !== 1 && item.parent_id === parentId)
  } catch {
    return []
  }
}

/** 获取计划树（含子计划递归） */
export function getPlanTree(rootId) {
  const plans = getPlanList()
  function buildTree(pid) {
    return plans
      .filter(p => (pid ? p.parent_id === pid : !p.parent_id))
      .map(p => ({
        ...p,
        children: buildTree(p.client_id)
      }))
  }
  return buildTree(rootId || null)
}
// ==================== 子计划模型（v2.3+：计划只包含子计划，子任务/阶段统一迁移为子计划） ====================

/** 子任务 → 子计划规格（AI 传入 subtasks 时自动转换） */
export function convertSubtasksToChildPlans(subtasks, base = {}) {
  if (!Array.isArray(subtasks)) return []
  return subtasks.filter(Boolean).map((s, i) => {
    const obj = typeof s === 'string' ? { title: s } : (s || {})
    const title = String(obj.title || obj.name || '').trim()
    const endTime = obj.end_time || obj.due_date || ''
    // 3.5.0：子层继承最近一层容器的窗口与循环字段（避免整棵树截止被误继承）
    const childBase = {
      priority: base.priority != null ? base.priority : 2,
      estimated_time: obj.start_time || base.estimated_time || '',
      start_time: obj.start_time || '',
      end_time: endTime,
      due_date: endTime || base.due_date || '',
      deadline: endTime || base.deadline || ''
    }
    return {
      title: title || ('子计划' + (i + 1)),
      description: obj.description || '',
      est_minutes: obj.est_minutes != null ? (Number(obj.est_minutes) || 0) : 0,
      start_time: childBase.start_time,
      end_time: childBase.end_time,
      status: obj.done === true ? 2 : 0,
      priority: childBase.priority,
      estimated_time: childBase.estimated_time,
      due_date: childBase.due_date,
      deadline: childBase.deadline,
      recur_type: obj.recur_type === 'daily' || obj.recur_type === 'weekly' ? obj.recur_type : '',
      recur_count: obj.recur_count != null ? (parseInt(obj.recur_count, 10) || 1) : 1,
      children: Array.isArray(obj.children) ? convertSubtasksToChildPlans(obj.children, childBase) : []
    }
  })
}

/** 阶段 → 子计划规格（历史 phases 数据迁移，阶段内子任务降为下一级子计划） */
export function convertPhasesToChildPlans(phases) {
  if (!Array.isArray(phases)) return []
  return phases.filter(Boolean).map((ph, i) => {
    const title = String(ph.title || '').trim()
    const subs = Array.isArray(ph.subtasks) ? ph.subtasks : (Array.isArray(ph.children) ? ph.children : [])
    const startDate = ph.start_date || ph.start_time || ''
    const endDate = ph.end_date || ph.end_time || ''
    const phaseBase = {
      priority: 2,
      estimated_time: startDate,
      start_time: startDate,
      due_date: endDate,
      deadline: endDate
    }
    return {
      title: title || ('第' + (i + 1) + '阶段'),
      description: ph.description || '',
      status: subs.length > 0 && subs.every(s => s && s.done === true) ? 2 : 0,
      priority: 2,
      estimated_time: startDate,
      start_time: startDate,
      due_date: endDate,
      deadline: endDate,
      recur_type: ph.recur_type === 'daily' || ph.recur_type === 'weekly' ? ph.recur_type : '',
      recur_count: ph.recur_count != null ? (parseInt(ph.recur_count, 10) || 1) : 1,
      children: convertSubtasksToChildPlans(subs, phaseBase)
    }
  })
}

/** 旧数据迁移：读取计划上的 subtasks/phases，产出子计划规格（优先子任务，其次阶段） */
export function buildChildrenSpecsFromLegacy(plan) {
  if (!plan) return []
  if (Array.isArray(plan.subtasks) && plan.subtasks.length > 0) {
    return convertSubtasksToChildPlans(plan.subtasks, {
      priority: plan.priority,
      estimated_time: plan.estimated_time || '',
      due_date: plan.due_date || plan.deadline || '',
      deadline: plan.deadline || ''
    })
  }
  if (Array.isArray(plan.phases) && plan.phases.length > 0) {
    return convertPhasesToChildPlans(plan.phases)
  }
  return []
}
