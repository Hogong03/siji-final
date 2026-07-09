/**
 * 离线同步队列
 *
 * 机制：
 *   用户操作 → addItem(本地Storage) → enqueue(入队列)
 *   App onShow / 定时 → trySync()
 *     → dequeue(批量出队) → POST /sync/batch
 *     → 成功 → 清空已同步项 + 更新 lastSyncTime
 *     → 失败 → 保留队列，下次重试
 */

import { logger } from './logger.js'

const QUEUE_KEY = 'sync_queue'
const LAST_SYNC_KEY = 'last_sync_time'

/** 入队：添加一条同步记录 */
export function enqueue(record) {
  const queue = getQueue()
  // 幂等：同 client_id 覆盖旧记录
  const idx = queue.findIndex(item => item.client_id === record.client_id)
  if (idx >= 0) {
    queue[idx] = { ...record, queued_at: Date.now() }
  } else {
    queue.push({ ...record, queued_at: Date.now() })
  }
  uni.setStorageSync(QUEUE_KEY, JSON.stringify(queue))
  return queue.length
}

/** 出队：获取所有待同步记录 */
export function dequeue(batchSize = 50) {
  const queue = getQueue()
  return queue.slice(0, batchSize)
}

/** 获取队列长度 */
export function getQueueLength() {
  return getQueue().length
}

/** 移除已同步的记录 */
export function removeFromQueue(clientIds) {
  const queue = getQueue()
  const remaining = queue.filter(item => !clientIds.includes(item.client_id))
  uni.setStorageSync(QUEUE_KEY, JSON.stringify(remaining))
}

/** 尝试同步 */
export async function trySync(apiPost) {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0 }

  try {
    const batch = queue.slice(0, 50)
    await apiPost('/sync/batch', { entries: batch }, 60000)
    const ids = batch.map(item => item.client_id)
    removeFromQueue(ids)
    uni.setStorageSync(LAST_SYNC_KEY, String(Date.now()))
    return { synced: batch.length }
  } catch (e) {
    logger.warn('[Sync] failed, will retry:', e.message)
    return { synced: 0, error: e.message }
  }
}

/** 获取上次同步时间 */
export function getLastSyncTime() {
  return uni.getStorageSync(LAST_SYNC_KEY) || ''
}

function getQueue() {
  const raw = uni.getStorageSync(QUEUE_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}
