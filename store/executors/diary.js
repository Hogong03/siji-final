import { saveDiary, updateIndex, getDiaryList, searchByIndex, RECORD_TYPE_KEYS, getUsedTags } from '@/utils/storage.js'
import { suggestTags } from '@/utils/diary-tags.js'
import { asyncSetStorageJSON } from '@/utils/store-helpers.js'
import { invalidatePromptCache } from '@/utils/ai/prompt-builder.js'
import { expandKeywords, matchesAnyKeywords } from '@/utils/search-synonyms.js'

/**
 * Diary 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId, _cacheCid, _findStorageKeyByCid }} ctx 上下文
 */
export function createDiaryExecutors(ctx) {
  // ==================== 创建操作 ====================

  /** 从完整句提取简短标题：去开头修饰词 → 取第一分句 → ≤20 字 */
  function deriveShortTitle(text) {
    let t = String(text || '').trim()
    if (!t) return ''
    t = t.replace(/^(?:今天|昨天|明天|昨晚|今早|早上|下午|晚上|最近|这(?:周|次|个)?(?:周末)?|打算|准备|计划|想要|想|在家|我们|我|然后|就|要|去|在|把|给|帮)+/g, '')
    const seg = t.split(/[，。；、,.;!！?？\n]/)[0].trim()
    return (seg || t).substring(0, 20)
  }

  /** 无意义标题（AI 常传"记录/日记"等占位词） */
  const USELESS_TITLE_RE = /^(?:记录|日记|今天|昨天|明天|想法|灵感|待办|备忘|闪念|日常|随笔|心情|生活|无标题|记录一下|记一下|备忘一下|备注|我的记录|我)$/

  /**
   * 自动生成记录标题：
   * - 多行正文：首行即标题（首行过长时提炼）
   * - 单行短句（≤10 字）：直接作标题
   * - 单行长文：去开头修饰词取第一分句提炼，避免"标题=正文开头"
   */
  function autoDiaryTitle(text) {
    const t = String(text || '').trim()
    if (!t) return ''
    const lb = t.indexOf('\n')
    if (lb > 0) {
      const firstLine = t.substring(0, lb).trim()
      if (firstLine.length <= 30) return firstLine
      return deriveShortTitle(firstLine) || firstLine.substring(0, 20)
    }
    if (t.length <= 10) return t
    return deriveShortTitle(t) || t.substring(0, 20)
  }

  /** 已有标签名（自动打标签优先复用它们，避免标签爆炸） */
  function knownTagNames() {
    try {
      return getUsedTags('diary').map(t => t && t.name).filter(Boolean)
    } catch (e) {
      return []
    }
  }

  function execCreateDiary(p) {
    const now = Date.now()
    // 兼容 AI 把正文误放 title 的情况：正文为空时用 title 兜底
    let text = (p.content || '').trim()
    let fallbackFromTitle = false
    if (!text && p.title) {
      text = String(p.title).trim()
      fallbackFromTitle = true
    }
    const lineBreak = text.indexOf('\n')
    // 标题自动生成：AI 传了合理标题（≠正文、非占位词、≤30 字）→ 直接采用；
    // 否则从正文自动提炼（多行取首行，单行长文去修饰词取第一分句），
    // 避免“标题=正文开头 50 字 / 标题是‘记录’占位词”（开发者反馈 2026-09-01）
    const aiTitle = fallbackFromTitle ? '' : String(p.title || '').trim()
    const sameAsContent = !!aiTitle && aiTitle === text
    let title
    if (fallbackFromTitle) {
      title = text.length <= 50 ? text : text.substring(0, 50)
    } else if (!aiTitle || sameAsContent || aiTitle.length > 30 || USELESS_TITLE_RE.test(aiTitle)) {
      title = autoDiaryTitle(text)
    } else {
      title = aiTitle
    }
    if (!title) title = '无标题'
    const content = fallbackFromTitle
      ? text
      : (lineBreak > 0 ? text.substring(lineBreak + 1).trim() : text)
    // 模型未传记录类型时按正文关键词推断（4.2.0：类型收敛到 3 种 —— 日记/心情→diary，待办→todo，其他→note；
    // 「想法/灵感」「闪念」并入 note，靠自动标签保语义）
    const inferredType = /日记|心情|随笔/.test(text) ? 'diary'
      : /想法|灵感|点子/.test(text) ? 'note'
      : /待办|要做|备忘/.test(text) ? 'todo'
      : /闪念|碎片/.test(text) ? 'note' : ''
    const recordType = RECORD_TYPE_KEYS.includes(p.record_type)
      ? p.record_type
      : (inferredType || 'note')

    const diary = {
      client_id: ctx.generateEntityId('diary'),
      title: title || '无标题',
      content: content,
      record_type: recordType,
      // 4.2.0：用户/AI 没给标签时，自动打 1-3 个（先复用已有标签库，再落到内置关键词表）
      tags: Array.isArray(p.tags) && p.tags.length > 0
        ? p.tags
        : suggestTags((p.title || '') + ' ' + (p.content || ''), knownTagNames()),
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
        record_type: diary.record_type,
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
    // 只改正文且旧标题无意义（空/占位词/与旧正文重复）时自动提炼新标题（反馈 2026-09-01）
    if (p.title == null && p.content != null && String(p.content).trim()) {
      const oldTitle = String(old.title || '').trim()
      const oldContent = String(old.content || '').trim()
      const titleUseless = !oldTitle || oldTitle === '无标题' || USELESS_TITLE_RE.test(oldTitle) || (!!oldContent && oldTitle === oldContent)
      if (titleUseless) {
        const derived = autoDiaryTitle(String(p.content))
        if (derived) updates.title = derived
      }
    }
    if (RECORD_TYPE_KEYS.includes(p.record_type)) updates.record_type = p.record_type
    // 旧类型值（idea / flash）改成 note，不再写进存储
    if (Array.isArray(p.tags)) updates.tags = p.tags
    updates.updated_at = Date.now()

    foundList[foundIdx] = { ...old, ...updates }
    asyncSetStorageJSON(`diary_${foundMonth}`, foundList)

    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at')
    const fieldLabels = { title: '标题', content: '内容', tags: '标签', record_type: '类型' }
    const changedText = changedFields.map(k => fieldLabels[k] || k).join('、')

    invalidatePromptCache()
    return {
      success: true,
      message: `已修改记录（${changedText}）`,
      detail: {
        type: 'diary', id: clientId,
        title: foundList[foundIdx].title,
        record_type: foundList[foundIdx].record_type,
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
      const kws = expandKeywords(p.keyword)
      let list = getDiaryList(month).filter(d =>
        matchesAnyKeywords(`${d.title || ''}\n${d.content || ''}`, kws)
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
          const kws = expandKeywords(p.keyword)
          filtered = filtered.filter(d =>
            matchesAnyKeywords(`${d.title || ''}\n${d.content || ''}`, kws)
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
          const kws = expandKeywords(p.keyword)
          filtered = filtered.filter(b =>
            matchesAnyKeywords(`${b.category || ''}\n${b.note || ''}`, kws)
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
