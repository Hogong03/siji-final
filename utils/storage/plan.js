/**
 * 计划 & 计划模板 CRUD
 *
 * 存储策略：不分片 → storage key: plan_all / plan_template_all
 */

import { getRawList } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

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
  const existing = getPlanTemplates()
  if (existing.length > 0) return
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
      client_id: 'tpl_habit', name: '早起习惯', icon: '🌅', color: '#F5A623',
      description: '21天养成早起习惯',
      plan_data: { priority: 1, subtasks: [
        { title: '设定每天6:30闹钟' }, { title: '早睡：23:00前入睡' },
        { title: '起床后喝一杯水' }, { title: '晨间10分钟拉伸' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    }
  ]
  defaults.forEach(t => savePlanTemplate(t))
}

// ==================== 计划 ====================

const PLAN_KEY = 'plan_all'

/** 获取所有计划（不含已删除） */
export function getPlanList() {
  const raw = uni.getStorageSync(PLAN_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted !== 1)
  } catch {
    return []
  }
}

/** 保存/更新计划 */
export function savePlan(plan) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === plan.client_id)
  plan.updated_at = Date.now()
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...plan }
  } else {
    list.push(plan)
  }
  asyncSetStorageJSON(PLAN_KEY, list)
  return plan
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
