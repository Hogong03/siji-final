/**
 * useChatTagSync - 聊天页面标签同步
 *
 * 从 chat/index.vue 拆出 — onShow 时同步所有消息的标签
 */
import { getPlanList, getDiaryList } from '@/utils/storage.js'

export function useChatTagSync(store) {
  function syncAllMessageTags() {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let plans = null
    let diaries = null

    for (const msg of store.messages) {
      const detail = msg?.execResult?.detail
      if (!detail || !detail.id) continue
      if (detail.type !== 'plan' && detail.type !== 'diary') continue

      let storedTags = null
      try {
        if (detail.type === 'plan') {
          if (!plans) plans = getPlanList()
          const plan = plans.find(p => p.client_id === detail.id)
          if (plan) storedTags = plan.tags
        } else if (detail.type === 'diary') {
          let month = thisMonth
          if (detail.created_at) {
            const d = new Date(detail.created_at)
            if (!isNaN(d.getTime())) month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          }
          let monthDiaries = diaries
          if (!monthDiaries || month !== thisMonth) {
            monthDiaries = getDiaryList(month)
            if (month === thisMonth) diaries = monthDiaries
          }
          const diary = monthDiaries.find(item => item.client_id === detail.id)
          if (diary) storedTags = diary.tags
        }
      } catch (e) { /* 静默忽略 */ }

      if (storedTags != null) {
        if (typeof storedTags === 'string') {
          try { const p = JSON.parse(storedTags); storedTags = Array.isArray(p) ? p : [] } catch { storedTags = [] }
        }
        if (Array.isArray(storedTags)) detail.tags = [...storedTags]
      }
    }
  }

  return { syncAllMessageTags }
}
