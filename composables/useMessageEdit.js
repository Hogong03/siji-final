/**
 * 消息编辑与标签管理 composable
 *
 * 从 chat/index.vue 拆出 — 处理账单/记录/计划的编辑保存和标签同步
 */
import { ref } from 'vue'

export function useMessageEdit(store) {
  const editingMessage = ref(null)

  function startEdit(index) {
    editingMessage.value = index
  }

  function cancelEdit() {
    editingMessage.value = null
  }

  /**
   * 保存编辑 — 根据 execResult.detail.type 分发到不同 store 方法
   */
  function saveEdit(formData) {
    if (editingMessage.value === null) return
    const msg = store.messages[editingMessage.value]
    const execResult = msg?.execResult
    if (!execResult?.detail || !formData) return

    const detail = execResult.detail
    let ok = true

    if (detail.type === 'bill') {
      const month = detail.bill_date ? String(detail.bill_date).substring(0, 7) : undefined
      ok = store.updateBill(detail.id, {
        amount: parseFloat(formData.amount) || 0,
        category: formData.category
      }, month)
      if (ok) {
        msg.execResult.detail.amount = parseFloat(formData.amount) || 0
        msg.execResult.detail.category = formData.category
        msg.execResult.message = `已记账 -¥${formData.amount} (${formData.category})`
      }
    } else if (detail.type === 'diary') {
      const month = _getMonth(detail.created_at)
      ok = store.updateDiary(detail.id, {
        title: formData.title
      }, month)
      if (ok) {
        msg.execResult.detail.title = formData.title
      }
    } else if (detail.type === 'plan') {
      store.updatePlan(detail.id, { title: formData.title })
      msg.execResult.detail.title = formData.title
    }

    uni.showToast({ title: ok ? '已更新' : '保存失败', icon: ok ? 'success' : 'none' })
    if (ok) editingMessage.value = null
  }

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
    editingMessage,
    startEdit,
    cancelEdit,
    saveEdit,
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
