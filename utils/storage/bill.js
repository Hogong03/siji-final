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
