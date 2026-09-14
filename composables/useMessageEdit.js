/**
 * 消息标签管理 composable
 *
 * 从 chat/index.vue 拆出 — 处理执行结果卡片标签的更新与同步
 * （执行结果卡片的标题/金额就地编辑已移除，见 ExecResultCard.vue）
 */
export function useMessageEdit(store) {
  /**
   * 更新标签
   */
  function handleUpdateTags({ detail, tags }) {
    if (!detail || !tags) return
    let ok = false
    if (detail.type === 'diary') {
      const month = _getMonth(detail.created_at)
      ok = store.updateDiary(detail.id, { tags: [...tags] }, month)
    } else if (detail.type === 'plan') {
      store.updatePlan(detail.id, { tags: [...tags] })
      ok = true
    }
    if (!ok) uni.showToast({ title: '标签保存失败', icon: 'none' })
  }

  /**
   * 同步所有消息的标签 — 从本地存储读取最新标签回写到消息列表
   */
  function syncAllMessageTags() {
    const thisMonth = _getMonth(new Date().toISOString())
    let plans = null
    let diaries = null

    for (const msg of store.messages) {
      const detail = msg?.execResult?.detail
      if (!detail || !detail.id) continue
      if (detail.type !== 'plan' && detail.type !== 'diary') continue

      let storedTags = null
      try {
        if (detail.type === 'plan') {
          if (!plans) plans = _getPlanList()
          const plan = plans.find(p => p.client_id === detail.id)
          if (plan) storedTags = plan.tags
        } else if (detail.type === 'diary') {
          let month = thisMonth
          if (detail.created_at) {
            const d = new Date(detail.created_at)
            if (!isNaN(d.getTime())) month = _getMonth(detail.created_at)
          }
          let monthDiaries = diaries
          if (!monthDiaries || month !== thisMonth) {
            monthDiaries = _getDiaryList(month)
            if (month === thisMonth) diaries = monthDiaries
          }
          const diary = monthDiaries.find(item => item.client_id === detail.id)
          if (diary) storedTags = diary.tags
        }
      } catch (e) { /* 静默忽略 */ }

      if (storedTags != null) {
        if (typeof storedTags === 'string') {
          try {
            const p = JSON.parse(storedTags)
            storedTags = Array.isArray(p) ? p : []
          } catch {
            storedTags = []
          }
        }
        if (Array.isArray(storedTags)) detail.tags = [...storedTags]
      }
    }
  }

  return {
    handleUpdateTags,
    syncAllMessageTags
  }
}

// ─── 内部工具 ───

function _getMonth(dateStr) {
  if (!dateStr) return undefined
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return undefined
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function _getPlanList() {
  try {
    const raw = uni.getStorageSync('siji_plans')
    return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
  } catch {
    return []
  }
}

function _getDiaryList(month) {
  try {
    const raw = uni.getStorageSync(`diary_${month}`)
    return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
  } catch {
    return []
  }
}
