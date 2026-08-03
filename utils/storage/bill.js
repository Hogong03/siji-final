/**
 * 账单 CRUD
 *
 * 存储策略：按月份分片 → storage key: bill_YYYY-MM
 */

import { getRawList, getMonthFromDateStr } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

/** 获取某月账单列表 */
export function getBillList(month) {
  const key = `bill_${month}`
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted !== 1)
  } catch {
    return []
  }
}

/** 获取某月已删除账单（回收站） */
export function getDeletedBills(month) {
  const key = `bill_${month}`
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted === 1)
  } catch {
    return []
  }
}

/** 恢复账单 */
export function restoreBill(clientId, month) {
  const key = `bill_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 0
    list[idx].updated_at = Date.now()
    asyncSetStorageJSON(key, list)
  }
}

/** 物理删除账单（不可恢复） */
export function purgeBill(clientId, month) {
  const key = `bill_${month}`
  const list = getRawList(key)
  const filtered = list.filter(item => item.client_id !== clientId)
  asyncSetStorageJSON(key, filtered)
}

/** 保存/更新账单 */
export function saveBill(bill) {
  const month = getMonthFromDateStr(bill.bill_date)
  const key = `bill_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === bill.client_id)
  bill.updated_at = Date.now()
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...bill }
  } else {
    list.push(bill)
  }
  asyncSetStorageJSON(key, list)
  return bill
}

/** 软删除账单 */
export function deleteBill(clientId, month) {
  const key = `bill_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 1
    list[idx].updated_at = Date.now()
    asyncSetStorageJSON(key, list)
  }
}

// ==================== 分类预算 ====================

/** 获取某月分类预算 */
export function getCategoryBudgets(month) {
  const raw = uni.getStorageSync(`cat_budget_${month}`)
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

/** 设置某月分类预算 */
export function setCategoryBudget(month, category, amount) {
  const budgets = getCategoryBudgets(month)
  budgets[category] = amount
  asyncSetStorageJSON(`cat_budget_${month}`, budgets)
}

/** 获取某月总预算 */
export function getMonthlyBudget(month) {
  const raw = uni.getStorageSync(`budget_${month}`)
  return raw ? parseFloat(raw) : 0
}

/** 设置某月总预算 */
export function setMonthlyBudget(month, amount) {
  uni.setStorageSync(`budget_${month}`, String(amount))
}

// ==================== 定期账单模板 ====================

/** 获取所有模板 */
export function getBillTemplates() {
  const raw = uni.getStorageSync('bill_templates')
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

/** 保存模板 */
export function saveBillTemplate(template) {
  const list = getBillTemplates()
  const idx = list.findIndex(t => t.id === template.id)
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...template }
  } else {
    list.push(template)
  }
  asyncSetStorageJSON('bill_templates', list)
}

/** 删除模板 */
export function deleteBillTemplate(id) {
  const list = getBillTemplates().filter(t => t.id !== id)
  asyncSetStorageJSON('bill_templates', list)
}
