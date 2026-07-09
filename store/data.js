/**
 * 数据操作 Store — AI 自动执行、撤销机制、就地编辑、CRUD
 *
 * 依赖 chatStore（读取 messages 用于 persistHistory 回调，但 persistHistory 已移至 chatStore，
 * 此 store 仅负责数据创建/查询/编辑/撤销）
 */
import { defineStore } from 'pinia'
import { logger } from '@/utils/logger.js'
import { ref } from 'vue'
import { generateEntityId } from '@/utils/uuid.js'
import {
  saveDiary, saveBill, savePlan,
  getDiaryList, getBillList, getPlanList,
  searchByIndex, updateIndex, rebuildIndex,
  exportJson, exportCsv,
  savePlanTemplate,
} from '@/utils/storage.js'
import { getProfile, saveProfile, clearProfile, setProfileEnabled, isProfileEnabled, smartUpdateProfile, getFilledCount, clearCardField } from '@/utils/profile.js'
import { asyncSetStorage, asyncSetStorageJSON, formatDateStr, normalizeDateStr } from '@/utils/store-helpers.js'

export const useDataStore = defineStore('data', () => {
  // ==================== clientId → storageKey 缓存 ====================
  // 避免每次 update/delete 都全盘扫描 getStorageInfoSync()
  const cidCache = { bill: {}, diary: {}, plan: {} }

  /** 记录 clientId 与存储键的映射 */
  function _cacheCid(type, clientId, storageKey) {
    if (clientId && storageKey) cidCache[type][clientId] = storageKey
  }

  /** 通过缓存查找存储键，缓存未命中时扫描一次并回填 */
  function _findStorageKeyByCid(type, clientId) {
    if (!clientId) return null
    // 1. 缓存命中
    if (cidCache[type][clientId]) return cidCache[type][clientId]
    // 2. 全盘扫描（仅首次未命中时）
    const prefix = type === 'bill' ? 'bill_' : type === 'diary' ? 'diary_' : 'plan_'
    const allKeys = uni.getStorageInfoSync().keys || []
    for (const key of allKeys) {
      if (!key.startsWith(prefix)) continue
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      if (list.some(item => item.client_id === clientId)) {
        cidCache[type][clientId] = key
        return key
      }
    }
    return null
  }

  // ==================== 撤销栈 ====================
  const undoStack = ref([])

  // ==================== AI 自动执行 ====================

  /**
   * 执行 AI 返回的 action — 自动保存到本地
   * 支持：单意图 / 复合意图 / 撤销
   */
  function executeAction(action) {
    if (!action || !action.type || action.type === 'none') {
      return { success: false, message: '无需执行', detail: null }
    }

    const { type, payload } = action
    const p = payload || {}

    try {
      if (type === 'undo_last') return execUndo()
      if (type === 'multi') return { success: false, message: '复合意图请用 executeActions', detail: null }

      switch (type) {
        case 'create_diary':       return execCreateDiary(p)
        case 'create_bill':        return execCreateBill(p)
        case 'create_plan':        return execCreatePlan(p)
        case 'update_plan':        return execUpdatePlan(p)
        case 'update_plan_subtask': return execUpdatePlanSubtask(p)
        case 'delete_plan':        return execDeletePlan(p)
        case 'update_bill':        return execUpdateBill(p)
        case 'delete_bill':        return execDeleteBill(p)
        case 'update_diary':       return execUpdateDiary(p)
        case 'delete_diary':       return execDeleteDiary(p)
        case 'create_plan_template': return execCreatePlanTemplate(p)
        case 'query_diary':        return execQueryDiary(p)
        case 'query_bill':         return execQueryBill(p)
        case 'query_plan':         return execQueryPlan(p)
        case 'query_stat':         return execQueryStat(p)
        case 'update_profile':     return execUpdateProfile(p)
        case 'smart_update_profile': return execSmartUpdateProfile(p)
        case 'get_profile':        return execGetProfile(p)
        case 'clear_profile':      return execClearProfile(p)
        case 'toggle_profile':     return execToggleProfile(p)
        default:                   return { success: false, message: '未知操作类型', detail: null }
      }
    } catch (e) {
      return { success: false, message: `执行失败: ${e.message}`, detail: null }
    }
  }

  // ==================== Profile 操作 ====================

  function execUpdateProfile(p) {
    // v2 兼容：将旧的扁平 payload 转为 smart_update_profile 格式
    const current = getProfile()
    // AI 驱动模式下，用户主动告知信息即视为同意开启，自动启用
    if (!current.enabled) {
      current.enabled = true
    }

    const updates = []
    const createCard = []

    // 基本信息字段 → basic 卡片
    const basicFields = ['nickname', 'gender', 'birthday', 'occupation', 'location', 'bio']
    const basicLabels = { nickname: '昵称', gender: '性别', birthday: '生日', occupation: '职业', location: '所在地', bio: '自我介绍' }
    for (const key of basicFields) {
      if (p[key] != null && p[key] !== '') {
        updates.push({ card: 'basic', field: key, value: p[key] })
      }
    }

    // 生活方式字段 → lifestyle 卡片
    const lifestyleFields = ['budget', 'sleepTime']
    for (const key of lifestyleFields) {
      if (p[key] != null && p[key] !== '') {
        updates.push({ card: 'lifestyle', field: key, value: p[key] })
      }
    }
    if (Array.isArray(p.hobbies) && p.hobbies.length > 0) {
      updates.push({ card: 'lifestyle', field: 'hobbies', value: p.hobbies })
    }
    if (Array.isArray(p.dietary) && p.dietary.length > 0) {
      updates.push({ card: 'lifestyle', field: 'dietary', value: p.dietary })
    }

    // custom 字段 → 自动创建卡片
    if (Array.isArray(p.custom) && p.custom.length > 0) {
      const validCustom = p.custom.filter(c => c.label && c.value)
      if (validCustom.length > 0) {
        createCard.push({ id: 'custom_ai', title: '更多信息', icon: 'sparkle' })
        for (const c of validCustom) {
          updates.push({ card: 'custom_ai', field: c.label, value: c.value })
        }
      }
    }

    if (updates.length === 0) {
      return { success: true, message: '没有新信息需要更新', detail: { type: 'profile', skipped: true } }
    }

    return smartUpdateProfile({ updates, createCard })
  }

  /** 智能更新 profile — AI 驱动的结构化操作 */
  function execSmartUpdateProfile(p) {
    return smartUpdateProfile(p)
  }

  function execGetProfile(p) {
    const profile = getProfile()
    const parts = []
    for (const card of profile.cards) {
      const fieldLines = []
      for (const [key, val] of Object.entries(card.fields)) {
        if (val == null || val === '') continue
        if (Array.isArray(val)) {
          if (val.length === 0) continue
          fieldLines.push(`${key}: ${val.join('、')}`)
        } else {
          fieldLines.push(`${key}: ${val}`)
        }
      }
      if (fieldLines.length > 0) {
        parts.push(`[${card.title}] ${fieldLines.join('；')}`)
      }
    }

    const enabled = profile.enabled ? '已开启' : '未开启'
    return {
      success: true,
      message: parts.length > 0 ? `当前个人信息（${enabled}）：\n${parts.join('\n')}` : `个人信息为空（${enabled}）`,
      detail: { type: 'profile', profile, fields: parts }
    }
  }

  function execClearProfile(p) {
    const current = getProfile()
    if (!current.enabled) {
      return { success: false, message: '个人信息功能未开启。', detail: { type: 'profile', notEnabled: true } }
    }
    if (p.card && p.field) {
      // 清空指定卡片的指定字段
      clearCardField(p.card, p.field)
      return { success: true, message: `已清空「${p.field}」`, detail: { type: 'profile', clearedField: p.field } }
    }
    if (p.card) {
      // 清空整张卡片（固定卡片只清空字段，不删除）
      const profile = getProfile()
      const card = profile.cards.find(c => c.id === p.card)
      if (card) {
        for (const key of Object.keys(card.fields)) {
          card.fields[key] = Array.isArray(card.fields[key]) ? [] : ''
        }
        saveProfile(profile)
      }
      return { success: true, message: `已清空「${card?.title || p.card}」`, detail: { type: 'profile', clearedCard: p.card } }
    }
    clearProfile()
    return { success: true, message: '已清空所有个人信息', detail: { type: 'profile', cleared: true } }
  }

  function execToggleProfile(p) {
    const enabled = !!p.enabled
    setProfileEnabled(enabled)
    return {
      success: true,
      message: enabled ? '已开启个人信息功能' : '已关闭个人信息功能',
      detail: { type: 'profile', enabled }
    }
  }

  /** 执行复合意图 — 依次执行多个 action */
  function executeActions(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
      return { results: [], allSuccess: false, message: '无操作' }
    }
    const results = actions.map(a => executeAction(a))
    const allSuccess = results.every(r => r.success)
    const msgs = results.filter(r => r.success && r.message !== '无需执行').map(r => r.message)
    return {
      results,
      allSuccess,
      message: msgs.join('；'),
      detail: results.map(r => r.detail).filter(Boolean)
    }
  }

  // ==================== 创建操作 ====================

  function execCreateDiary(p) {
    const now = Date.now()
    const diary = {
      client_id: generateEntityId('diary'),
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
    undoStack.value.push({ type: 'diary', clientId: diary.client_id, action: 'create' })
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

  function execCreateBill(p) {
    const now = new Date()
    let billDate = normalizeDateStr(p.bill_date) || formatDateStr(now)
    // 防御 AI 幻觉日期：距今天超 365 天 → 回退到今天
    const parsed = new Date(billDate)
    if (!isNaN(parsed.getTime())) {
      const diffDays = Math.abs((parsed.getTime() - now.getTime()) / 86400000)
      if (diffDays > 365) {
        logger.warn('[execCreateBill] AI 返回异常日期:', billDate, '→ 回退到今天', formatDateStr(now))
        billDate = formatDateStr(now)
      }
    }
    const bill = {
      client_id: generateEntityId('bill'),
      type: p.type || 'expense',
      amount: parseFloat(p.amount) || 0,
      category: p.category || '其他',
      note: p.note || '',
      bill_date: billDate,
      created_at: now.getTime(),
      updated_at: now.getTime(),
      is_deleted: 0
    }
    saveBill(bill)
    updateIndex('bill', bill)
    undoStack.value.push({ type: 'bill', clientId: bill.client_id, action: 'create', month: bill.bill_date.substring(0, 7) })
    const sign = bill.type === 'expense' ? '-' : '+'
    return {
      success: true,
      message: `已记账 ${sign}¥${bill.amount} (${bill.category})`,
      detail: {
        type: 'bill', id: bill.client_id,
        amount: bill.amount, category: bill.category,
        bill_date: bill.bill_date, billType: bill.type,
        note: bill.note
      }
    }
  }

  function execCreatePlan(p) {
    const now = Date.now()
    const plan = {
      client_id: generateEntityId('plan'),
      title: p.title || '新计划',
      description: p.description || '',
      priority: p.priority != null ? p.priority : 2,
      status: p.status != null ? p.status : 1,
      tags: Array.isArray(p.tags) ? p.tags : [],
      subtasks: Array.isArray(p.subtasks) ? p.subtasks.map((s, i) => ({
        id: i + 1,
        title: s.title || s,
        done: false
      })) : [],
      // 父计划ID — 支持计划嵌套
      parent_id: p.parent_id || '',
      // 精确到秒的时间（YYYY-MM-DD HH:mm:ss 格式）
      deadline: p.deadline || '',           // 截止时间（精确到秒）
      due_date: p.due_date || p.deadline || '',  // 兼容字段
      estimated_time: p.estimated_time || p.plan_date || '',  // 预计开始时间（精确到秒）
      start_time: p.start_time || p.estimated_time || '',  // 开始时间（精确到秒）
      end_time: p.end_time || p.deadline || '',            // 结束时间（精确到秒）
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    savePlan(plan)
    updateIndex('plan', plan)
    undoStack.value.push({ type: 'plan', clientId: plan.client_id, action: 'create' })
    return {
      success: true,
      message: plan.parent_id ? '子计划已创建' : '计划已创建',
      detail: {
        type: 'plan', id: plan.client_id,
        title: plan.title, description: plan.description,
        priority: plan.priority, tags: plan.tags,
        subtaskCount: plan.subtasks.length,
        subtasks: plan.subtasks,
        parent_id: plan.parent_id,
        deadline: plan.deadline,
        due_date: plan.due_date,
        estimated_time: plan.estimated_time,
        start_time: plan.start_time,
        end_time: plan.end_time,
        created_at: plan.created_at
      }
    }
  }

  function execUpdatePlan(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const list = getPlanList()
    const idx = list.findIndex(item => item.client_id === clientId)
    if (idx < 0) {
      return { success: false, message: '计划不存在', detail: null }
    }
    const old = list[idx]
    const updates = {}
    if (p.title != null) updates.title = p.title
    if (p.description != null) updates.description = p.description
    if (p.priority != null) updates.priority = p.priority
    if (p.status != null) updates.status = p.status
    if (Array.isArray(p.tags)) updates.tags = p.tags
    if (p.deadline != null) { updates.deadline = p.deadline; updates.due_date = p.deadline }
    if (p.due_date != null) updates.due_date = p.due_date
    if (p.estimated_time != null) updates.estimated_time = p.estimated_time
    if (p.start_time != null) updates.start_time = p.start_time
    if (p.end_time != null) updates.end_time = p.end_time
    if (p.parent_id != null) updates.parent_id = p.parent_id
    if (Array.isArray(p.subtasks)) updates.subtasks = p.subtasks

    const updated = { ...old, ...updates, updated_at: Date.now() }
    savePlan(updated)

    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at')
    const fieldLabels = {
      title: '标题', description: '描述', priority: '优先级', status: '状态',
      tags: '标签', deadline: '截止日期', due_date: '截止日期',
      estimated_time: '预计时间', subtasks: '子任务'
    }
    const changedText = changedFields.map(k => fieldLabels[k] || k).join('、')

    return {
      success: true,
      message: changedText ? `已更新计划（${changedText}）` : '计划已更新',
      detail: {
        type: 'plan', id: updated.client_id,
        title: updated.title, description: updated.description,
        priority: updated.priority, tags: updated.tags,
        subtaskCount: updated.subtasks.length,
        subtasks: updated.subtasks,
        deadline: updated.deadline,
        due_date: updated.due_date,
        estimated_time: updated.estimated_time,
        updatedFields: changedFields,
        created_at: updated.created_at
      }
    }
  }

  // ==================== 查询操作 ====================

  function execQueryStat(p) {
    const now = new Date()
    const month = p.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const bills = getBillList(month).filter(b => b.is_deleted !== 1)
    const diaries = getDiaryList(month).filter(d => d.is_deleted !== 1)
    const plans = getPlanList().filter(pl => pl.is_deleted !== 1)
    const activePlans = plans.filter(pl => pl.status === 1)
    const completedPlans = plans.filter(pl => pl.status === 2)
    const expenseBills = bills.filter(b => b.type === 'expense')
    const incomeBills = bills.filter(b => b.type === 'income')
    const totalExpense = expenseBills.reduce((s, b) => s + b.amount, 0)
    const totalIncome = incomeBills.reduce((s, b) => s + b.amount, 0)
    // 分类统计
    const categoryMap = {}
    expenseBills.forEach(b => {
      categoryMap[b.category] = (categoryMap[b.category] || 0) + b.amount
    })
    const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]
    // 情绪统计
    const moodMap = {}
    diaries.forEach(d => {
      const mood = d.mood || '平静'
      moodMap[mood] = (moodMap[mood] || 0) + 1
    })
    const topMood = Object.entries(moodMap).sort((a, b) => b[1] - a[1])[0]

    return {
      success: true,
      message: `${month} 概览：支出¥${totalExpense.toFixed(0)} 收入¥${totalIncome.toFixed(0)} ${bills.length}笔账单，${diaries.length}篇日记，${activePlans.length}个进行中计划`,
      detail: {
        type: 'query_stat', month,
        billCount: bills.length, diaryCount: diaries.length,
        activePlanCount: activePlans.length, completedPlanCount: completedPlans.length,
        totalExpense, totalIncome, netIncome: totalIncome - totalExpense,
        topCategory: topCategory ? topCategory[0] : '无',
        topCategoryAmount: topCategory ? topCategory[1] : 0,
        topMood: topMood ? topMood[0] : '无',
        categoryBreakdown: categoryMap
      }
    }
  }

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

  function execQueryBill(p) {
    const now = new Date()
    const month = p.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    if (p.category) {
      const indexResults = searchByIndex('bill', p.category)
      if (indexResults.length > 0) {
        const matchedIds = new Set(indexResults.map(r => r.id))
        let list = getBillList(month).filter(b => matchedIds.has(b.client_id))
        const totalExpense = list.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
        const totalIncome = list.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
        return {
          success: true,
          message: `${month} ${p.category} 支出 ¥${totalExpense.toFixed(2)}，收入 ¥${totalIncome.toFixed(2)}，共 ${list.length} 笔`,
          detail: { type: 'query_bill', month, count: list.length, totalExpense, totalIncome, items: list.slice(0, 5) }
        }
      }
    }

    let list = getBillList(month)
    if (p.category) list = list.filter(b => b.category === p.category)
    const totalExpense = list.filter(b => b.type === 'expense').reduce((s, b) => s + b.amount, 0)
    const totalIncome = list.filter(b => b.type === 'income').reduce((s, b) => s + b.amount, 0)
    return {
      success: true,
      message: `${month} 支出 ¥${totalExpense.toFixed(2)}，收入 ¥${totalIncome.toFixed(2)}，共 ${list.length} 笔`,
      detail: { type: 'query_bill', month, count: list.length, totalExpense, totalIncome, items: list.slice(0, 5) }
    }
  }

  function execQueryPlan(p) {
    let list = getPlanList()
    if (p.status === 'active') list = list.filter(pl => pl.status === 1)
    else if (p.status === 'completed') list = list.filter(pl => pl.status === 2)
    return {
      success: true,
      message: `共 ${list.length} 个计划${p.status === 'active' ? '（进行中）' : p.status === 'completed' ? '（已完成）' : ''}`,
      detail: { type: 'query_plan', count: list.length, items: list.slice(0, 5) }
    }
  }

  // ==================== 修改/删除操作 ====================

  function execUpdateBill(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少账单ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // 从所有月份中查找账单
    let foundMonth = null
    let foundList = null
    let foundIdx = -1

    // 优先在指定月份查找
    if (p.bill_date) {
      const m = String(p.bill_date).substring(0, 7)
      const list = JSON.parse(uni.getStorageSync(`bill_${m}`) || '[]')
      const idx = list.findIndex(b => b.client_id === clientId)
      if (idx >= 0) { foundMonth = m; foundList = list; foundIdx = idx; _cacheCid('bill', clientId, `bill_${m}`) }
    }
    // 其次当前月
    if (foundIdx < 0) {
      const list = JSON.parse(uni.getStorageSync(`bill_${currentMonth}`) || '[]')
      const idx = list.findIndex(b => b.client_id === clientId)
      if (idx >= 0) { foundMonth = currentMonth; foundList = list; foundIdx = idx; _cacheCid('bill', clientId, `bill_${currentMonth}`) }
    }
    // 通过缓存查找
    if (foundIdx < 0) {
      const cachedKey = _findStorageKeyByCid('bill', clientId)
      if (cachedKey) {
        const list = JSON.parse(uni.getStorageSync(cachedKey) || '[]')
        const idx = list.findIndex(b => b.client_id === clientId)
        if (idx >= 0) { foundMonth = cachedKey.replace('bill_', ''); foundList = list; foundIdx = idx }
      }
    }
    if (foundIdx < 0) {
      return { success: false, message: '账单不存在', detail: null }
    }

    const old = foundList[foundIdx]
    const updates = {}
    if (p.amount != null) updates.amount = parseFloat(p.amount) || 0
    if (p.category != null) updates.category = p.category
    if (p.note != null) updates.note = p.note
    if (p.type != null) updates.type = p.type
    if (p.bill_date != null) updates.bill_date = p.bill_date
    updates.updated_at = Date.now()

    foundList[foundIdx] = { ...old, ...updates }
    asyncSetStorageJSON(`bill_${foundMonth}`, foundList)

    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at')
    const fieldLabels = { amount: '金额', category: '分类', note: '备注', type: '类型', bill_date: '日期' }
    const changedText = changedFields.map(k => fieldLabels[k] || k).join('、')

    return {
      success: true,
      message: `已修改账单（${changedText}）`,
      detail: {
        type: 'bill', id: clientId,
        amount: foundList[foundIdx].amount,
        category: foundList[foundIdx].category,
        bill_date: foundList[foundIdx].bill_date,
        billType: foundList[foundIdx].type,
        note: foundList[foundIdx].note,
        updatedFields: changedFields
      }
    }
  }

  function execDeleteBill(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少账单ID', detail: null }
    }
    const clientId = p.client_id || p.id
    // 优先缓存查找
    const cachedKey = _findStorageKeyByCid('bill', clientId)
    const keysToSearch = cachedKey ? [cachedKey] : (uni.getStorageInfoSync().keys || []).filter(k => k.startsWith('bill_'))
    for (const key of keysToSearch) {
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      const idx = list.findIndex(b => b.client_id === clientId)
      if (idx >= 0) {
        list[idx].is_deleted = 1
        list[idx].updated_at = Date.now()
        asyncSetStorageJSON(key, list)
        _cacheCid('bill', clientId, key)
        return {
          success: true,
          message: '已删除账单',
          detail: { type: 'bill', id: clientId, deleted: true }
        }
      }
    }
    return { success: false, message: '账单不存在', detail: null }
  }

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
      foundMonth = currentMonth; foundList = currentList; foundIdx = idx; _cacheCid('diary', clientId, `diary_${currentMonth}`)
    } else {
      const cachedKey = _findStorageKeyByCid('diary', clientId)
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
    const cachedKey = _findStorageKeyByCid('diary', clientId)
    const keysToSearch = cachedKey ? [cachedKey] : (uni.getStorageInfoSync().keys || []).filter(k => k.startsWith('diary_'))
    for (const key of keysToSearch) {
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      const idx = list.findIndex(d => d.client_id === clientId)
      if (idx >= 0) {
        list[idx].is_deleted = 1
        list[idx].updated_at = Date.now()
        asyncSetStorageJSON(key, list)
        _cacheCid('diary', clientId, key)
        return {
          success: true,
          message: '已删除日记',
          detail: { type: 'diary', id: clientId, deleted: true }
        }
      }
    }
    return { success: false, message: '日记不存在', detail: null }
  }

  function execUpdatePlanSubtask(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const list = getPlanList()
    const idx = list.findIndex(item => item.client_id === clientId)
    if (idx < 0) {
      return { success: false, message: '计划不存在', detail: null }
    }
    const plan = list[idx]
    const subtaskId = parseInt(p.subtask_id)
    const subtask = plan.subtasks?.find(s => s.id === subtaskId)
    if (!subtask) {
      return { success: false, message: '子任务不存在', detail: null }
    }
    subtask.done = p.done === true
    plan.updated_at = Date.now()
    savePlan(plan)

    const doneCount = plan.subtasks.filter(s => s.done).length
    return {
      success: true,
      message: `子任务「${subtask.title}」已标记为${p.done ? '完成' : '未完成'}`,
      detail: {
        type: 'plan', id: plan.client_id,
        title: plan.title,
        subtaskCount: plan.subtasks.length,
        subtaskDoneCount: doneCount,
        subtasks: plan.subtasks,
        updatedFields: ['subtasks']
      }
    }
  }

  function execDeletePlan(p) {
    if (!p.client_id && !p.id) {
      return { success: false, message: '缺少计划ID', detail: null }
    }
    const clientId = p.client_id || p.id
    const rawList = JSON.parse(uni.getStorageSync('plan_all') || '[]')
    const idx = rawList.findIndex(p => p.client_id === clientId)
    if (idx < 0) {
      return { success: false, message: '计划不存在', detail: null }
    }
    rawList[idx].is_deleted = 1
    rawList[idx].updated_at = Date.now()
    asyncSetStorageJSON('plan_all', rawList)
    return {
      success: true,
      message: '已删除计划',
      detail: { type: 'plan', id: clientId, deleted: true }
    }
  }

  // ==================== 撤销机制 ====================

  function execUndo() {
    if (undoStack.value.length === 0) {
      return { success: false, message: '没有可撤销的操作', detail: null }
    }

    const last = undoStack.value.pop()

    if (last.type === 'diary') {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const rawList = JSON.parse(uni.getStorageSync(`diary_${month}`) || '[]')
      const idx = rawList.findIndex(d => d.client_id === last.clientId)
      if (idx >= 0) {
        rawList[idx].is_deleted = 1
        rawList[idx].updated_at = Date.now()
        asyncSetStorageJSON(`diary_${month}`, rawList)
        return { success: true, message: '已撤销日记', detail: { type: 'undo', originalType: 'diary' } }
      }
    } else if (last.type === 'bill') {
      const month = last.month
      const rawList = JSON.parse(uni.getStorageSync(`bill_${month}`) || '[]')
      const idx = rawList.findIndex(b => b.client_id === last.clientId)
      if (idx >= 0) {
        rawList[idx].is_deleted = 1
        rawList[idx].updated_at = Date.now()
        asyncSetStorageJSON(`bill_${month}`, rawList)
        return { success: true, message: '已撤销记账', detail: { type: 'undo', originalType: 'bill' } }
      }
    } else if (last.type === 'plan') {
      const rawList = JSON.parse(uni.getStorageSync('plan_all') || '[]')
      const idx = rawList.findIndex(p => p.client_id === last.clientId)
      if (idx >= 0) {
        rawList[idx].is_deleted = 1
        rawList[idx].updated_at = Date.now()
        asyncSetStorageJSON('plan_all', rawList)
        return { success: true, message: '已撤销计划', detail: { type: 'undo', originalType: 'plan' } }
      }
    }

    return { success: false, message: '撤销失败：找不到原记录', detail: null }
  }

  function getUndoCount() {
    return undoStack.value.length
  }

  // ==================== 计划模板 ====================

  function createPlanFromTemplate(tpl) {
    const now = Date.now()
    const plan = {
      client_id: generateEntityId('plan'),
      title: tpl.name || '新计划',
      description: tpl.description || '',
      priority: tpl.plan_data?.priority || 2,
      status: 1,
      tags: Array.isArray(tpl.plan_data?.tags) ? tpl.plan_data.tags : [],
      subtasks: (tpl.plan_data?.subtasks || []).map((s, i) => ({
        id: i + 1,
        title: s.title || s,
        done: false
      })),
      deadline: '',
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    savePlan(plan)
    updateIndex('plan', plan)
    undoStack.value.push({ type: 'plan', clientId: plan.client_id, action: 'create' })
    return plan
  }

  function execCreatePlanTemplate(p) {
    const now = Date.now()
    const tpl = {
      client_id: generateEntityId('tpl'),
      name: p.name || '自定义模板',
      icon: p.icon || '📋',
      color: p.color || '#18181B',
      description: p.description || '',
      plan_data: {
        priority: p.priority || 2,
        subtasks: Array.isArray(p.subtasks) ? p.subtasks.map(s => ({
          title: typeof s === 'string' ? s : (s.title || s)
        })) : []
      },
      created_at: now,
      updated_at: now,
      is_deleted: 0
    }
    savePlanTemplate(tpl)
    return {
      success: true,
      message: `模板「${tpl.name}」已保存`,
      detail: { type: 'plan_template', id: tpl.client_id, name: tpl.name, subtaskCount: tpl.plan_data.subtasks.length }
    }
  }

  // ==================== 就地编辑 ====================

  function updateBill(clientId, updates, month) {
    const m = month || (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    const rawList = JSON.parse(uni.getStorageSync(`bill_${m}`) || '[]')
    const rawIdx = rawList.findIndex(b => b.client_id === clientId)
    if (rawIdx >= 0) {
      rawList[rawIdx] = { ...rawList[rawIdx], ...updates, updated_at: Date.now() }
      asyncSetStorageJSON(`bill_${m}`, rawList)
      return true
    }
    // 缓存查找兜底
    const cachedKey = _findStorageKeyByCid('bill', clientId)
    const keysToSearch = cachedKey ? [cachedKey] : (uni.getStorageInfoSync().keys || []).filter(k => k.startsWith('bill_'))
    for (const key of keysToSearch) {
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      const idx = list.findIndex(b => b.client_id === clientId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates, updated_at: Date.now() }
        asyncSetStorageJSON(key, list)
        _cacheCid('bill', clientId, key)
        return true
      }
    }
    logger.warn('[updateBill] 未找到账单:', clientId)
    return false
  }

  function updateDiary(clientId, updates, month) {
    const m = month || (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    })()
    const rawList = JSON.parse(uni.getStorageSync(`diary_${m}`) || '[]')
    const rawIdx = rawList.findIndex(d => d.client_id === clientId)
    if (rawIdx >= 0) {
      rawList[rawIdx] = { ...rawList[rawIdx], ...updates, updated_at: Date.now() }
      asyncSetStorageJSON(`diary_${m}`, rawList)
      return true
    }
    const cachedKey = _findStorageKeyByCid('diary', clientId)
    const keysToSearch = cachedKey ? [cachedKey] : (uni.getStorageInfoSync().keys || []).filter(k => k.startsWith('diary_'))
    for (const key of keysToSearch) {
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      const idx = list.findIndex(d => d.client_id === clientId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates, updated_at: Date.now() }
        asyncSetStorageJSON(key, list)
        _cacheCid('diary', clientId, key)
        return true
      }
    }
    logger.warn('[updateDiary] 未找到日记:', clientId)
    return false
  }

  function updatePlan(clientId, updates) {
    const list = getPlanList()
    const idx = list.findIndex(p => p.client_id === clientId)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updates, updated_at: Date.now() }
      const rawList = JSON.parse(uni.getStorageSync('plan_all') || '[]')
      const rawIdx = rawList.findIndex(p => p.client_id === clientId)
      if (rawIdx >= 0) {
        rawList[rawIdx] = list[idx]
        asyncSetStorageJSON('plan_all', rawList)
      }
    }
  }

  return {
    // AI 自动执行
    executeAction, executeActions,
    // 就地编辑
    updateBill, updateDiary, updatePlan,
    // 计划模板
    createPlanFromTemplate, execCreatePlanTemplate,
    // 撤销
    getUndoCount,
    // 索引 & 导出（从 storage.js 透传）
    rebuildIndex, exportJson, exportCsv,
  }
})
