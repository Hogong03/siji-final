import { saveBill, getBillList, getDiaryList, getPlanList, searchByIndex, updateIndex } from '@/utils/storage.js'
import { asyncSetStorageJSON, formatDateStr, normalizeDateStr } from '@/utils/store-helpers.js'
import { logger } from '@/utils/logger.js'

/**
 * Bill 相关 executor 工厂函数
 * @param {{ undoStack, cidCache, generateEntityId, _cacheCid, _findStorageKeyByCid }} ctx 上下文
 */
export function createBillExecutors(ctx) {
  // ==================== 创建操作 ====================

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
      client_id: ctx.generateEntityId('bill'),
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
    ctx.undoStack.value.push({ type: 'bill', clientId: bill.client_id, action: 'create', month: bill.bill_date.substring(0, 7) })
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
      if (idx >= 0) { foundMonth = m; foundList = list; foundIdx = idx; ctx._cacheCid('bill', clientId, `bill_${m}`) }
    }
    // 其次当前月
    if (foundIdx < 0) {
      const list = JSON.parse(uni.getStorageSync(`bill_${currentMonth}`) || '[]')
      const idx = list.findIndex(b => b.client_id === clientId)
      if (idx >= 0) { foundMonth = currentMonth; foundList = list; foundIdx = idx; ctx._cacheCid('bill', clientId, `bill_${currentMonth}`) }
    }
    // 通过缓存查找
    if (foundIdx < 0) {
      const cachedKey = ctx._findStorageKeyByCid('bill', clientId)
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
    const cachedKey = ctx._findStorageKeyByCid('bill', clientId)
    const keysToSearch = cachedKey ? [cachedKey] : (uni.getStorageInfoSync().keys || []).filter(k => k.startsWith('bill_'))
    for (const key of keysToSearch) {
      const list = JSON.parse(uni.getStorageSync(key) || '[]')
      const idx = list.findIndex(b => b.client_id === clientId)
      if (idx >= 0) {
        list[idx].is_deleted = 1
        list[idx].updated_at = Date.now()
        asyncSetStorageJSON(key, list)
        ctx._cacheCid('bill', clientId, key)
        return {
          success: true,
          message: '已删除账单',
          detail: { type: 'bill', id: clientId, deleted: true }
        }
      }
    }
    return { success: false, message: '账单不存在', detail: null }
  }

  // ==================== 查询操作 ====================

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

  return { execCreateBill, execUpdateBill, execDeleteBill, execQueryBill, execQueryStat }
}
