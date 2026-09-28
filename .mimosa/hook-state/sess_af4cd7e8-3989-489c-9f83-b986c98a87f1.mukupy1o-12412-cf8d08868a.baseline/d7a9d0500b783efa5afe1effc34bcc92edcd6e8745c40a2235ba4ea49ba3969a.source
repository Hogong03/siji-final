/**
 * Feedback executor — 体验反馈 CRUD
 *
 * 对接 utils/storage/feedback.js 的存储层
 * 提供 AI 可调用的 create/update/delete/query 工具
 */

import { getFeedbackList, saveFeedback, deleteFeedback, updateFeedback, getFeedbackStats } from '@/utils/storage.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'
import { logger } from '@/utils/logger.js'

/**
 * 创建 Feedback executor 工厂
 * @param {{ undoStack, cidCache, generateEntityId, _cacheCid, _findStorageKeyByCid }} ctx
 */
export function createFeedbackExecutors(ctx) {
  // ==================== 创建 ====================
  function execCreateFeedback(p) {
    const item = saveFeedback({
      rating: p.rating || 5,
      category: p.category || '功能建议',
      content: p.content || '',
      contact: p.contact || ''
    })
    invalidatePromptCache()
    return {
      success: true,
      message: '反馈已提交',
      detail: {
        type: 'feedback',
        id: item.client_id,
        rating: item.rating,
        category: item.category,
        content: item.content.substring(0, 100),
        created_at: item.created_at
      }
    }
  }

  // ==================== 修改 ====================
  function execUpdateFeedback(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少反馈ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const updates = {}
    if (p.rating != null) updates.rating = p.rating
    if (p.category != null) updates.category = p.category
    if (p.content != null) updates.content = p.content
    if (p.contact != null) updates.contact = p.contact

    const updated = updateFeedback(clientId, updates)
    if (!updated) {
      return { success: false, message: '反馈不存在', detail: null }
    }
    invalidatePromptCache()
    return {
      success: true,
      message: '反馈已更新',
      detail: {
        type: 'feedback',
        id: clientId,
        rating: updated.rating,
        category: updated.category,
        content: (updated.content || '').substring(0, 100),
        updated_at: updated.updated_at
      }
    }
  }

  // ==================== 删除 ====================
  function execDeleteFeedback(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少反馈ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const list = getFeedbackList()
    const exists = list.find(f => f.client_id === clientId)
    if (!exists) {
      return { success: false, message: '反馈不存在', detail: null }
    }
    deleteFeedback(clientId)
    invalidatePromptCache()
    return {
      success: true,
      message: '反馈已删除',
      detail: { type: 'feedback', id: clientId, deleted: true }
    }
  }

  // ==================== 查询 ====================
  function execQueryFeedback(p) {
    const list = getFeedbackList()
    if (p.category) {
      const filtered = list.filter(f => f.category === p.category)
      return {
        success: true,
        message: `分类「${p.category}」下有 ${filtered.length} 条反馈`,
        detail: {
          type: 'query_feedback',
          category: p.category,
          count: filtered.length,
          items: filtered.slice(0, 10).map(f => ({
            id: f.client_id,
            rating: f.rating,
            category: f.category,
            content: (f.content || '').substring(0, 80),
            created_at: f.created_at
          }))
        }
      }
    }
    return {
      success: true,
      message: `共 ${list.length} 条反馈`,
      detail: {
        type: 'query_feedback',
        count: list.length,
        items: list.slice(0, 10).map(f => ({
          id: f.client_id,
          rating: f.rating,
          category: f.category,
          content: (f.content || '').substring(0, 80),
          created_at: f.created_at
        }))
      }
    }
  }

  // ==================== 统计 ====================
  function execQueryFeedbackStats() {
    const stats = getFeedbackStats()
    return {
      success: true,
      message: `共 ${stats.total} 条反馈，平均评分 ${stats.avgRating}`,
      detail: {
        type: 'query_feedback_stats',
        total: stats.total,
        avgRating: stats.avgRating,
        categoryMap: stats.categoryMap
      }
    }
  }

  return { execCreateFeedback, execUpdateFeedback, execDeleteFeedback, execQueryFeedback, execQueryFeedbackStats }
}
