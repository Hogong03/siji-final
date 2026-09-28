/**
 * 记录关联推荐与关联账单
 * 从 detail.vue 拆出，避免 detail.vue 超 300 行
 */
import { ref } from 'vue'
import { getDiaryList } from '@/utils/storage.js'

/**
 * 加载同标签的关联记录
 * @param {string[]} tags - 当前记录的标签
 * @param {string} excludeId - 当前记录 client_id（排除自身）
 * @param {string} currentMonth - 当前月份 YYYY-MM
 * @returns {{ relatedRecords: Ref<Array>, loadRelated: Function }}
 */
export function useRelatedRecords(tags, excludeId, currentMonth) {
  const relatedRecords = ref([])

  function loadRelated() {
    if (!tags.value || tags.value.length === 0 || !excludeId.value) {
      relatedRecords.value = []
      return
    }

    const now = new Date()
    const months = []
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const found = []
    for (const m of months) {
      if (m === currentMonth.value) continue
      try {
        const list = getDiaryList(m)
        for (const d of list) {
          if (d.client_id === excludeId.value || d.is_deleted === 1) continue
          const dTags = Array.isArray(d.tags) ? d.tags : []
          if (dTags.some(t => tags.value.includes(t))) {
            found.push({
              client_id: d.client_id,
              title: d.title || (d.content || '').substring(0, 30) || '无标题',
              content: (d.content || '').substring(0, 60),
              month: m,
              created_at: d.created_at
            })
          }
        }
      } catch (e) {
        // 月份无数据，跳过
      }
    }
    relatedRecords.value = found.slice(0, 3)
  }

  return { relatedRecords, loadRelated }
}

/**
 * 加载同日账单
 * @param {Ref<number|null>} createdAt - 记录创建时间戳
 * @returns {{ relatedBills: Ref<Array>, loadRelatedBills: Function }}
 */
export function useRelatedBills(createdAt) {
  const relatedBills = ref([])

  function loadRelatedBills() {
    if (!createdAt.value) {
      relatedBills.value = []
      return
    }

    const date = new Date(createdAt.value)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const targetDay = date.getDate()

    try {
      const raw = uni.getStorageSync(`bill_${monthKey}`) || '[]'
      const bills = JSON.parse(raw)
      relatedBills.value = bills.filter(b => {
        if (b.is_deleted === 1) return false
        const billDate = new Date(b.bill_date || b.created_at)
        return billDate.getDate() === targetDay &&
               billDate.getMonth() === date.getMonth() &&
               billDate.getFullYear() === date.getFullYear()
      }).slice(0, 5).map(b => ({
        amount: b.amount,
        category: b.category || '未分类',
        note: (b.note || '').substring(0, 30)
      }))
    } catch (e) {
      relatedBills.value = []
    }
  }

  return { relatedBills, loadRelatedBills }
}
