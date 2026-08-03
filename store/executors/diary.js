import { saveDiary, updateIndex, getDiaryList, searchByIndex } from '@/utils/storage.js'
import { asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'

/**
 * Diary 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId, _cacheCid, _findStorageKeyByCid }} ctx 上下文
 */
export function createDiaryExecutors(ctx) {
  // ==================== 创建操作 ====================

  function execCreateDiary(p) {
    const now = Date.now()
    const text = (p.content || '').trim()
    const lineBreak = text.indexOf('\n')
    const title = lineBreak > 0 ? text.substring(0, lineBreak).trim() : (text.length <= 50 ? text : text.substring(0, 50))
    const content = lineBreak > 0 ? text.substring(lineBreak + 1).trim() : ''

    const diary = {
      client_id: ctx.generateEntityId('diary'),
      title: title || '无标题',
      content: content,
      tags: Array.isArray(p.tags) ? p.tags : [],
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    saveDiary(diary)
    updateIndex('diary', diary)
    ctx.undoStack.value.push({ type: 'diary', clientId: diary.client_id, action: 'create' })
    invalidatePromptCache()
    return {
      success: true,
      message: '记录已保存',
      detail: {
        type: 'diary', id: diary.client_id,
        title: diary.title, content: diary.content,
        tags: diary.tags,
        created_at: diary.created_at
      }
    }
  }

  // ==================== 修改/删除操作 ====================

  function execUpdateDiary(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少记录ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // 查找记录
    let foundMonth = null
    let foundList = null
    let foundIdx = -1

    const currentList = JSON.parse(uni.getStorageSync(`diary_${currentMonth}`) || '[]')
    const idx = currentList.findIndex(d => d.client_id === clientId)
    if (idx >= 0) {
      foundMonth = currentMonth; foundList = currentList; foundIdx = idx
      ctx._cacheCid('diary', clientId, `diary_${currentMonth}`)
    } else {
      const cachedKey = ctx._findStorageKeyByCid('diary', clientId)
      if (cachedKey) {
        const list = JSON.parse(uni.getStorageSync(cachedKey) || '[]')
        const i = list.findIndex(d => d.client_id === clientId)
        if (i >= 0) { foundMonth = cachedKey.replace('diary_', ''); foundList = list; foundIdx = i }
      }
    }
    if (foundIdx < 0) {
      return { success: false, message: '记录不存在', detail: null }
    }

    const old = foundList[foundIdx]
    const updates = {}
    if (p.title != null) updates.title = p.title
    if (p.content != null) updates.content = p.content
    if (Array.isArray(p.tags)) updates.tags = p.tags
    updates.updated_at = Date.now()

    foundList[foundIdx] = { ...old, ...updates }
    asyncSetStorageJSON(`diary_${foundMonth}`, foundList)

    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at')
    const fieldLabels = { title: '标题', content: '内容', tags: '标签' }
    const changedText = changedFields.map(k => fieldLabels[k] || k).join('、')

    invalidatePromptCache()
    return {
      success: true,
      message: `已修改记录（${changedText}）`,
      detail: {
        type: 'diary', id: clientId,
        title: foundList[foundIdx].title,
        updatedFields: changedFields
      }
    }
  }

  function execDeleteDiary(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少记录ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const cachedKey = ctx._findStorageKeyByCid('diary', clientId)
    const keysToSearch = cachedKey ? [cachedKey] : (uni.getStorageInfoSync().keys || []).filter(k => k.startsWith('diary_'))
    for (const key of keysToSearch) {
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      const idx = list.findIndex(d => d.client_id === clientId)
      if (idx >= 0) {
        list[idx].is_deleted = 1
        list[idx].updated_at = Date.now()
        asyncSetStorageJSON(key, list)
        ctx._cacheCid('diary', clientId, key)
        invalidatePromptCache()
        return {
          success: true,
          message: '已删除记录',
          detail: { type: 'diary', id: clientId, deleted: true }
        }
      }
    }
    return { success: false, message: '记录不存在', detail: null }
  }

  // ==================== 查询操作 ====================

  function execQueryDiary(p) {
    const now = new Date()
    const month = p.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    if (p.keyword) {
      const indexResults = searchByIndex('diary', p.keyword)
      if (indexResults.length > 0) {
        const matchedIds = new Set(indexResults.map(r => r.id))
        let list = getDiaryList(month).filter(d => matchedIds.has(d.client_id))
        return {
          success: true,
          message: `找到 ${list.length} 篇包含「${p.keyword}」的记录`,
          detail: { type: 'query_diary', month, count: list.length, items: list.slice(0, 5) }
        }
      }
      const kw = p.keyword.toLowerCase()
      let list = getDiaryList(month).filter(d =>
        (d.title || '').toLowerCase().includes(kw) ||
        (d.content || '').toLowerCase().includes(kw)
      )
      return {
        success: true,
        message: `找到 ${list.length} 篇包含「${p.keyword}」的记录`,
        detail: { type: 'query_diary', month, count: list.length, items: list.slice(0, 5) }
      }
    }

    const list = getDiaryList(month)
    return {
      success: true,
      message: `${month} 共 ${list.length} 篇记录`,
      detail: { type: 'query_diary', month, count: list.length, items: list.slice(0, 5) }
    }
  }

  // ==================== B1: 周报/月报 ====================

  function execSummarizeDiaries(p) {
    const now = new Date()
    let startDate, endDate, label

    if (p.period === 'week') {
      startDate = new Date(now.getTime() - 7 * 86400000)
      endDate = now
      label = '本周'
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = now
      label = '本月'
    }

    // 遍历范围内的月份
    const months = []
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    while (cursor <= endDate) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }

    const allDiaries = []
    for (const m of months) {
      try {
        const list = JSON.parse(uni.getStorageSync(`diary_${m}`) || '[]')
        allDiaries.push(...list.filter(d =>
          d.is_deleted !== 1 &&
          d.created_at >= startDate.getTime() &&
          d.created_at <= endDate.getTime()
        ))
      } catch (e) { /* 月份无数据 */ }
    }

    if (allDiaries.length === 0) {
      return { success: false, message: `${label}还没有记录`, detail: null }
    }

    // 按日期排序
    allDiaries.sort((a, b) => a.created_at - b.created_at)

    return {
      success: true,
      message: `${label}共 ${allDiaries.length} 篇记录，请生成总结`,
      detail: {
        type: 'summarize_diaries',
        period: p.period,
        count: allDiaries.length,
        items: allDiaries.map(d => ({
          title: d.title || '无标题',
          content: (d.content || '').substring(0, 100),
          tags: Array.isArray(d.tags) ? d.tags : [],
          date: new Date(d.created_at).toLocaleDateString()
        }))
      }
    }
  }

  // ==================== E2: 跨类型查询 ====================

  function execQueryCombined(p) {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const types = Array.isArray(p.types) ? p.types : ['diary', 'bill']
    const results = []

    if (types.includes('diary')) {
      try {
        const diaryList = JSON.parse(uni.getStorageSync(`diary_${month}`) || '[]')
        let filtered = diaryList.filter(d => d.is_deleted !== 1)
        if (p.keyword) {
          const kw = p.keyword.toLowerCase()
          filtered = filtered.filter(d =>
            (d.title || '').toLowerCase().includes(kw) ||
            (d.content || '').toLowerCase().includes(kw)
          )
        }
        results.push(...filtered.slice(0, 5).map(d => ({
          type: 'diary',
          title: d.title || '无标题',
          content: (d.content || '').substring(0, 60),
          date: new Date(d.created_at).toLocaleDateString()
        })))
      } catch (e) { /* */ }
    }

    if (types.includes('bill')) {
      try {
        const billList = JSON.parse(uni.getStorageSync(`bill_${month}`) || '[]')
        let filtered = billList.filter(b => b.is_deleted !== 1)
        if (p.keyword) {
          const kw = p.keyword.toLowerCase()
          filtered = filtered.filter(b =>
            (b.category || '').toLowerCase().includes(kw) ||
            (b.note || '').toLowerCase().includes(kw)
          )
        }
        results.push(...filtered.slice(0, 5).map(b => ({
          type: 'bill',
          amount: b.amount,
          category: b.category || '未分类',
          note: (b.note || '').substring(0, 30),
          date: new Date(b.bill_date || b.created_at).toLocaleDateString()
        })))
      } catch (e) { /* */ }
    }

    return {
      success: true,
      message: `找到 ${results.length} 条结果`,
      detail: { type: 'query_combined', count: results.length, items: results }
    }
  }

  return { execCreateDiary, execUpdateDiary, execDeleteDiary, execQueryDiary, execSummarizeDiaries, execQueryCombined }
}
