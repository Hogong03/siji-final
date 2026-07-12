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
    const diary = {
      client_id: ctx.generateEntityId('diary'),
      title: p.title || '无标题',
      content: p.content || '',
      mood: p.mood || '平静',
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
      message: '日记已保存',
      detail: {
        type: 'diary', id: diary.client_id,
        title: diary.title, content: diary.content,
        mood: diary.mood, tags: diary.tags,
        created_at: diary.created_at
      }
    }
  }

  // ==================== 修改/删除操作 ====================

  function execUpdateDiary(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少日记ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // 查找日记
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
      return { success: false, message: '日记不存在', detail: null }
    }

    const old = foundList[foundIdx]
    const updates = {}
    if (p.title != null) updates.title = p.title
    if (p.content != null) updates.content = p.content
    if (p.mood != null) updates.mood = p.mood
    if (Array.isArray(p.tags)) updates.tags = p.tags
    updates.updated_at = Date.now()

    foundList[foundIdx] = { ...old, ...updates }
    asyncSetStorageJSON(`diary_${foundMonth}`, foundList)

    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at')
    const fieldLabels = { title: '标题', content: '内容', mood: '心情', tags: '标签' }
    const changedText = changedFields.map(k => fieldLabels[k] || k).join('、')

    invalidatePromptCache()
    return {
      success: true,
      message: `已修改日记（${changedText}）`,
      detail: {
        type: 'diary', id: clientId,
        title: foundList[foundIdx].title,
        mood: foundList[foundIdx].mood,
        updatedFields: changedFields
      }
    }
  }

  function execDeleteDiary(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少日记ID', detail: null }
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
          message: '已删除日记',
          detail: { type: 'diary', id: clientId, deleted: true }
        }
      }
    }
    return { success: false, message: '日记不存在', detail: null }
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
          message: `找到 ${list.length} 篇包含「${p.keyword}」的日记`,
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
        message: `找到 ${list.length} 篇包含「${p.keyword}」的日记`,
        detail: { type: 'query_diary', month, count: list.length, items: list.slice(0, 5) }
      }
    }

    const list = getDiaryList(month)
    return {
      success: true,
      message: `${month} 共 ${list.length} 篇日记`,
      detail: { type: 'query_diary', month, count: list.length, items: list.slice(0, 5) }
    }
  }

  return { execCreateDiary, execUpdateDiary, execDeleteDiary, execQueryDiary }
}
