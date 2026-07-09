/**
 * 本地存储 CRUD 封装
 *
 * 策略：
 *  - 日记按月份分片 → storage key: diary_YYYY-MM
 *  - 账单按月份分片 → storage key: bill_YYYY-MM
 *  - 计划不分片   → storage key: plan_all
 *  - 所有写操作：先落本地 → 入同步队列
 *  - 软删除：is_deleted=1
 */

// ==================== 日记 ====================

/** 获取某月日记列表 */
export function getDiaryList(month) {
  const key = `diary_${month}`
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted !== 1)
  } catch {
    return []
  }
}

/** 保存/更新日记 */
export function saveDiary(diary) {
  // 防御：created_at 缺失或无效时 fallback 到当前时间
  // 避免 getMonthFromDate(undefined) → "NaN-NaN" → 存到 diary_NaN-NaN 错误 key
  if (!diary.created_at || typeof diary.created_at !== 'number' || isNaN(diary.created_at)) {
    diary.created_at = Date.now()
    logger.warn('[saveDiary] created_at 无效，已 fallback 到当前时间')
  }
  const month = getMonthFromDate(diary.created_at)
  const key = `diary_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === diary.client_id)
  diary.updated_at = Date.now()
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...diary }
  } else {
    list.push(diary)
  }
  uni.setStorageSync(key, JSON.stringify(list))
  return diary
}

/** 软删除日记 */
export function deleteDiary(clientId, month) {
  const key = `diary_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 1
    list[idx].updated_at = Date.now()
    uni.setStorageSync(key, JSON.stringify(list))
  }
}

/** 按 client_id 获取单条日记 */
export function getDiaryById(clientId, month) {
  const key = `diary_${month}`
  const list = getRawList(key)
  return list.find(item => item.client_id === clientId && item.is_deleted !== 1) || null
}

// ==================== 账单 ====================

/** 获取某月账单列表 */
export function getBillList(month) {
  const key = `bill_${month}`
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted !== 1)
  } catch {
    return []
  }
}

/** 保存/更新账单 */
export function saveBill(bill) {
  const month = getMonthFromDateStr(bill.bill_date)
  const key = `bill_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === bill.client_id)
  bill.updated_at = Date.now()
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...bill }
  } else {
    list.push(bill)
  }
  uni.setStorageSync(key, JSON.stringify(list))
  return bill
}

/** 软删除账单 */
export function deleteBill(clientId, month) {
  const key = `bill_${month}`
  const list = getRawList(key)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 1
    list[idx].updated_at = Date.now()
    uni.setStorageSync(key, JSON.stringify(list))
  }
}

// ==================== 计划模板 ====================

const TEMPLATE_KEY = 'plan_template_all'

/** 获取所有计划模板 */
export function getPlanTemplates() {
  const raw = uni.getStorageSync(TEMPLATE_KEY)
  if (!raw) return []
  try { return JSON.parse(raw).filter(t => t.is_deleted !== 1) }
  catch { return [] }
}

/** 保存/更新计划模板 */
export function savePlanTemplate(tpl) {
  const list = getRawList(TEMPLATE_KEY)
  const idx = list.findIndex(t => t.client_id === tpl.client_id)
  tpl.updated_at = Date.now()
  if (idx >= 0) list[idx] = { ...list[idx], ...tpl }
  else list.push(tpl)
  uni.setStorageSync(TEMPLATE_KEY, JSON.stringify(list))
  return tpl
}

/** 软删除计划模板 */
export function deletePlanTemplate(clientId) {
  const list = getRawList(TEMPLATE_KEY)
  const idx = list.findIndex(t => t.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 1
    list[idx].updated_at = Date.now()
    uni.setStorageSync(TEMPLATE_KEY, JSON.stringify(list))
  }
}

/** 预置默认模板（首次启动时调用） */
export function ensureDefaultTemplates() {
  const existing = getPlanTemplates()
  if (existing.length > 0) return
  const defaults = [
    {
      client_id: 'tpl_fitness', name: '健身计划', icon: '🏃', color: '#E8A838',
      description: '每周运动4次，逐步提升体能',
      plan_data: { priority: 2, subtasks: [
        { title: '周一：有氧30分钟' }, { title: '周三：力量训练40分钟' },
        { title: '周五：有氧+核心30分钟' }, { title: '周日：拉伸放松20分钟' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_reading', name: '阅读计划', icon: '📚', color: '#18181B',
      description: '每月读完2本书，养成阅读习惯',
      plan_data: { priority: 1, subtasks: [
        { title: '选书并购买/借阅' }, { title: '每天阅读30分钟' },
        { title: '做读书笔记' }, { title: '写读后感' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_travel', name: '旅行准备', icon: '✈️', color: '#4A7C59',
      description: '旅行前完整准备清单',
      plan_data: { priority: 2, subtasks: [
        { title: '确定目的地和日期' }, { title: '预订机票和酒店' },
        { title: '制定行程攻略' }, { title: '准备行李清单' }, { title: '检查证件有效期' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_study', name: '考试备考', icon: '🎓', color: '#D35D5D',
      description: '系统备考计划，分阶段复习',
      plan_data: { priority: 3, subtasks: [
        { title: '收集考试大纲和教材' }, { title: '制定每日学习时间表' },
        { title: '第一轮：通读教材' }, { title: '第二轮：专题练习' },
        { title: '第三轮：模拟考试' }, { title: '考前冲刺复习' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    },
    {
      client_id: 'tpl_habit', name: '早起习惯', icon: '🌅', color: '#F5A623',
      description: '21天养成早起习惯',
      plan_data: { priority: 1, subtasks: [
        { title: '设定每天6:30闹钟' }, { title: '早睡：23:00前入睡' },
        { title: '起床后喝一杯水' }, { title: '晨间10分钟拉伸' }
      ]},
      created_at: Date.now(), updated_at: Date.now(), is_deleted: 0
    }
  ]
  defaults.forEach(t => savePlanTemplate(t))
}

// ==================== 计划 ====================

const PLAN_KEY = 'plan_all'

/** 获取所有计划（不含已删除） */
export function getPlanList() {
  const raw = uni.getStorageSync(PLAN_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted !== 1)
  } catch {
    return []
  }
}

/** 保存/更新计划 */
export function savePlan(plan) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === plan.client_id)
  plan.updated_at = Date.now()
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...plan }
  } else {
    list.push(plan)
  }
  uni.setStorageSync(PLAN_KEY, JSON.stringify(list))
  return plan
}

/** 软删除计划 */
export function deletePlan(clientId) {
  const list = getRawList(PLAN_KEY)
  const idx = list.findIndex(item => item.client_id === clientId)
  if (idx >= 0) {
    list[idx].is_deleted = 1
    list[idx].updated_at = Date.now()
    // 级联软删除所有子计划
    const children = list.filter(item => item.parent_id === clientId && item.is_deleted !== 1)
    children.forEach(child => {
      child.is_deleted = 1
      child.updated_at = Date.now()
    })
    uni.setStorageSync(PLAN_KEY, JSON.stringify(list))
  }
}

/** 获取子计划列表 */
export function getChildPlans(parentId) {
  const raw = uni.getStorageSync(PLAN_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(item => item.is_deleted !== 1 && item.parent_id === parentId)
  } catch {
    return []
  }
}

/** 获取计划树（含子计划递归） */
export function getPlanTree(rootId) {
  const plans = getPlanList()
  function buildTree(pid) {
    return plans
      .filter(p => (pid ? p.parent_id === pid : !p.parent_id))
      .map(p => ({
        ...p,
        children: buildTree(p.client_id)
      }))
  }
  return buildTree(rootId || null)
}

// ==================== 本地索引（优化查询速度） ====================

const INDEX_KEY = 'siji_index'

/**
 * 重建全量索引 — 遍历所有月份分片，构建关键词倒排索引
 * 建议在 App 启动时调用一次（或每次写入后增量更新）
 * 索引结构：
 * {
 *   diary: { "关键词": [{ id, month, title, date }], ... },
 *   bill:  { "分类": [{ id, month, amount, date }], ... },
 *   updatedAt: timestamp
 * }
 */
export function rebuildIndex() {
  const index = { diary: {}, bill: {}, plan: {}, updatedAt: Date.now() }

  // 扫描所有 storage key，找出各月份分片
  const allKeys = uni.getStorageInfoSync().keys || []

  allKeys.forEach(key => {
    if (key.startsWith('diary_')) {
      const month = key.substring(6)
      const list = getRawList(key)
      list.forEach(item => {
        if (item.is_deleted === 1) return
        // 按标题和内容分词建立倒排索引
        const words = tokenize(`${item.title || ''} ${item.content || ''} ${item.mood || ''}`)
        words.forEach(w => {
          if (!index.diary[w]) index.diary[w] = []
          index.diary[w].push({
            id: item.client_id,
            month,
            title: item.title || '',
            date: item.created_at
          })
        })
      })
    } else if (key.startsWith('bill_')) {
      const month = key.substring(5)
      const list = getRawList(key)
      list.forEach(item => {
        if (item.is_deleted === 1) return
        // 按分类和备注建索引
        const words = tokenize(`${item.category || ''} ${item.note || ''}`)
        words.forEach(w => {
          if (!index.bill[w]) index.bill[w] = []
          index.bill[w].push({
            id: item.client_id,
            month,
            amount: item.amount,
            category: item.category,
            date: item.bill_date
          })
        })
      })
    }
  })

  // 计划索引
  const planList = getRawList('plan_all')
  planList.forEach(item => {
    if (item.is_deleted === 1) return
    const words = tokenize(`${item.title || ''} ${item.description || ''}`)
    words.forEach(w => {
      if (!index.plan[w]) index.plan[w] = []
      index.plan[w].push({
        id: item.client_id,
        title: item.title || '',
        status: item.status
      })
    })
  })

  uni.setStorageSync(INDEX_KEY, JSON.stringify(index))
  return index
}

/** 获取当前索引（不存在则自动构建） */
export function getIndex() {
  const raw = uni.getStorageSync(INDEX_KEY)
  if (!raw) return rebuildIndex()
  try { return JSON.parse(raw) } catch { return rebuildIndex() }
}

/**
 * 通过索引搜索 — 比遍历全部分片快很多
 * @param {string} type - diary / bill / plan
 * @param {string} keyword - 搜索关键词
 * @returns {array} 匹配的记录 ID 列表
 */
export function searchByIndex(type, keyword) {
  if (!keyword) return []
  const index = getIndex()
  const bucket = index[type] || {}
  const kw = keyword.toLowerCase()
  const results = []

  // 精确匹配
  if (bucket[kw]) {
    results.push(...bucket[kw])
  }

  // 模糊匹配（关键词包含关系）
  Object.keys(bucket).forEach(k => {
    if (k !== kw && (k.includes(kw) || kw.includes(k))) {
      // 去重
      const existing = new Set(results.map(r => r.id))
      bucket[k].forEach(item => {
        if (!existing.has(item.id)) results.push(item)
      })
    }
  })

  return results
}

/** 增量更新索引（单条写入后调用） */
export function updateIndex(type, item) {
  if (!item || item.is_deleted === 1) return
  const index = getIndex()
  const bucket = index[type] || (index[type] = {})
  const text = type === 'diary'
    ? `${item.title || ''} ${item.content || ''} ${item.mood || ''}`
    : type === 'bill'
      ? `${item.category || ''} ${item.note || ''}`
      : `${item.title || ''} ${item.description || ''}`

  const words = tokenize(text)
  const month = type === 'plan' ? null : (item.bill_date ? item.bill_date.substring(0, 7) : getMonthFromDate(item.created_at))

  words.forEach(w => {
    if (!bucket[w]) bucket[w] = []
    // 去重
    const exists = bucket[w].find(b => b.id === item.client_id)
    if (!exists) {
      bucket[w].push({
        id: item.client_id,
        month,
        title: item.title || '',
        date: item.created_at || item.bill_date
      })
    }
  })

  index.updatedAt = Date.now()
  uni.setStorageSync(INDEX_KEY, JSON.stringify(index))
}

/** 简易分词 — 按空格和标点分割，中文按字切分 */
function tokenize(text) {
  if (!text) return []
  // 英文/数字按空格分，中文逐字
  const tokens = []
  // 先提取英文单词
  const enWords = text.match(/[a-zA-Z0-9]+/g) || []
  tokens.push(...enWords.map(w => w.toLowerCase()))
  // 中文逐字（2-gram 简化）
  const cnChars = text.replace(/[\s\w]/g, '').split('')
  for (let i = 0; i < cnChars.length - 1; i++) {
    tokens.push(cnChars[i] + cnChars[i + 1])
  }
  return tokens.filter(t => t.length > 0)
}

// ==================== 数据导出 ====================

/**
 * 导出全部数据为 JSON 对象
 * @returns {object} 包含所有日记、账单、计划的完整数据
 */
/**
 * 全局搜索 — 同时搜索日记/账单/计划
 * @param {string} keyword - 搜索关键词
 * @param {object} options - { types?: ['diary','bill','plan'], days?: number }
 * @returns {Array} 搜索结果（按类型分组）
 */
export function globalSearch(keyword, options = {}) {
  if (!keyword || keyword.trim().length < 1) return []
  const kw = keyword.trim().toLowerCase()
  const types = options.types || ['diary', 'bill', 'plan']
  const days = options.days || 0 // 0=不限时间
  const now = Date.now()
  const dayMs = 86400000
  const results = []

  // --- 日记搜索 ---
  if (types.includes('diary')) {
    const allKeys = uni.getStorageInfoSync().keys || []
    allKeys.forEach(key => {
      if (!key.startsWith('diary_')) return
      const list = getRawList(key)
      list.forEach(item => {
        if (item.is_deleted === 1) return
        if (days > 0 && item.created_at && (now - item.created_at) > days * dayMs) return
        const title = (item.title || '').toLowerCase()
        const content = (item.content || '').toLowerCase()
        const mood = (item.mood || '').toLowerCase()
        if (title.includes(kw) || content.includes(kw) || mood.includes(kw)) {
          results.push({
            type: 'diary',
            id: item.client_id,
            title: item.title || '无标题',
            preview: (item.content || '').substring(0, 60),
            date: item.created_at,
            extra: item.mood ? '心情: ' + item.mood : '',
            route: '/pages/diary/detail?id=' + item.client_id
          })
        }
      })
    })
  }

  // --- 账单搜索 ---
  if (types.includes('bill')) {
    const allKeys = uni.getStorageInfoSync().keys || []
    allKeys.forEach(key => {
      if (!key.startsWith('bill_')) return
      const list = getRawList(key)
      list.forEach(item => {
        if (item.is_deleted === 1) return
        if (days > 0 && item.bill_date) {
          const d = new Date(item.bill_date).getTime()
          if ((now - d) > days * dayMs) return
        }
        const category = (item.category || '').toLowerCase()
        const note = (item.note || '').toLowerCase()
        if (category.includes(kw) || note.includes(kw)) {
          results.push({
            type: 'bill',
            id: item.client_id,
            title: (item.type === 'income' || item.type === 1 ? '收入: ' : '支出: ') + (item.category || '其他'),
            preview: item.note || '',
            date: item.bill_date,
            extra: '¥' + (item.amount || 0).toFixed(2),
            route: '/pages/bill/edit?id=' + item.client_id
          })
        }
      })
    })
  }

  // --- 计划搜索 ---
  if (types.includes('plan')) {
    const list = getRawList('plan_all')
    list.forEach(item => {
      if (item.is_deleted === 1) return
      if (days > 0 && item.created_at && (now - item.created_at) > days * dayMs) return
      const title = (item.title || '').toLowerCase()
      const desc = (item.description || '').toLowerCase()
      if (title.includes(kw) || desc.includes(kw)) {
        results.push({
          type: 'plan',
          id: item.client_id,
          title: item.title || '无标题',
          preview: (item.description || '').substring(0, 60),
          date: item.created_at,
          extra: item.status === 2 ? '已完成' : item.status === 1 ? '进行中' : '待开始',
          route: '/pages/plan/detail?id=' + item.client_id
        })
      }
    })
  }

  // 按日期降序
  results.sort((a, b) => (b.date || 0) - (a.date || 0))
  return results
}

export function exportAllData(options = {}) {
  const { sanitize = true } = options
  const allKeys = uni.getStorageInfoSync().keys || []
  const data = {
    meta: {
      app: '思迹',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      deviceId: sanitize ? '***' : (uni.getStorageSync('siji_device_id') || '')
    },
    diaries: [],
    bills: [],
    plans: []
  }

  allKeys.forEach(key => {
    if (key.startsWith('diary_')) {
      const list = getRawList(key)
      data.diaries.push(...list.filter(item => item.is_deleted !== 1))
    } else if (key.startsWith('bill_')) {
      const list = getRawList(key)
      data.bills.push(...list.filter(item => item.is_deleted !== 1))
    }
  })

  data.plans = getRawList('plan_all').filter(item => item.is_deleted !== 1)

  // 脱敏：移除 API Key、敏感配置
  if (sanitize) {
    // 不导出任何包含 key/secret/token 的存储项
    const sensitiveKeys = allKeys.filter(k =>
      k.includes('key') || k.includes('secret') || k.includes('token') || k.includes('provider')
    )
    // 导出的数据中不包含敏感字段
  }

  return data
}

/**
 * 导出数据为 JSON 字符串
 */
export function exportJson() {
  return JSON.stringify(exportAllData(), null, 2)
}

/**
 * 导出数据为 CSV 格式（扁平化）
 * @param {string} type - diary / bill / plan
 */
export function exportCsv(type) {
  const data = exportAllData()
  if (type === 'diary') {
    const headers = ['client_id', 'title', 'content', 'mood', 'tags', 'created_at']
    const rows = data.diaries.map(d => [
      d.client_id,
      escapeCsv(d.title || ''),
      escapeCsv(d.content || ''),
      escapeCsv(d.mood || ''),
      escapeCsv((d.tags || []).join(';')),
      new Date(d.created_at).toLocaleString()
    ].join(','))
    return headers.join(',') + '\n' + rows.join('\n')
  } else if (type === 'bill') {
    const headers = ['client_id', 'type', 'amount', 'category', 'note', 'bill_date']
    const rows = data.bills.map(b => [
      b.client_id,
      b.type,
      b.amount,
      escapeCsv(b.category || ''),
      escapeCsv(b.note || ''),
      b.bill_date || ''
    ].join(','))
    return headers.join(',') + '\n' + rows.join('\n')
  } else if (type === 'plan') {
    const headers = ['client_id', 'title', 'description', 'priority', 'status', 'deadline']
    const rows = data.plans.map(p => [
      p.client_id,
      escapeCsv(p.title || ''),
      escapeCsv(p.description || ''),
      p.priority || 2,
      p.status === 1 ? '进行中' : '已完成',
      p.deadline || ''
    ].join(','))
    return headers.join(',') + '\n' + rows.join('\n')
  }
  return ''
}

function escapeCsv(str) {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

// ==================== 体验反馈 ====================

const FEEDBACK_KEY = 'siji_feedback'

/** 获取所有反馈 */
export function getFeedbackList() {
  const raw = uni.getStorageSync(FEEDBACK_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw).filter(f => !f.is_deleted).sort((a, b) => b.created_at - a.created_at)
  } catch { return [] }
}

/** 保存反馈 */
export function saveFeedback(fb) {
  const list = getRawList(FEEDBACK_KEY)
  const item = {
    client_id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    rating: fb.rating || 5,
    category: fb.category || '功能建议',
    content: fb.content || '',
    contact: fb.contact || '',
    created_at: Date.now(),
    is_deleted: 0
  }
  list.push(item)
  uni.setStorageSync(FEEDBACK_KEY, JSON.stringify(list))
  return item
}

/** 删除反馈 */
export function deleteFeedback(clientId) {
  const list = getRawList(FEEDBACK_KEY)
  const filtered = list.filter(f => f.client_id !== clientId)
  uni.setStorageSync(FEEDBACK_KEY, JSON.stringify(filtered))
}

/** 更新本地反馈（按 client_id 匹配替换） */
export function updateFeedback(clientId, updates) {
  const list = getRawList(FEEDBACK_KEY)
  const idx = list.findIndex(f => f.client_id === clientId)
  if (idx < 0) return null
  list[idx] = { ...list[idx], ...updates, updated_at: Date.now() }
  uni.setStorageSync(FEEDBACK_KEY, JSON.stringify(list))
  return list[idx]
}

/** 获取反馈统计 */
export function getFeedbackStats() {
  const list = getFeedbackList()
  const total = list.length
  const avgRating = total > 0 ? (list.reduce((s, f) => s + (f.rating || 0), 0) / total).toFixed(1) : '0.0'
  const categoryMap = {}
  list.forEach(f => {
    const c = f.category || '其他'
    categoryMap[c] = (categoryMap[c] || 0) + 1
  })
  return { total, avgRating, categoryMap }
}

// ==================== 标签管理 ====================

/**
 * 获取全局标签注册表
 * @param {'diary'|'plan'} type
 * @returns {Array<{name:string, color:string, count:number}>}
 */
export function getTags(type) {
  const key = `siji_tags_${type}`
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

/** 保存标签注册表 */
function setTags(type, tags) {
  uni.setStorageSync(`siji_tags_${type}`, JSON.stringify(tags))
}

/**
 * 获取所有实际使用的标签（从真实数据中提取）
 * 优先级：从数据中收集 > 从注册表读取
 */
export function getUsedTags(type) {
  const tagMap = {} // name → count

  if (type === 'diary') {
    const allKeys = uni.getStorageInfoSync().keys || []
    allKeys.filter(k => k.startsWith('diary_')).forEach(key => {
      const list = getRawList(key)
      list.forEach(item => {
        if (item.is_deleted === 1) return
        const tags = Array.isArray(item.tags) ? item.tags : []
        tags.forEach(t => {
          if (t && t.trim()) {
            const name = t.trim()
            tagMap[name] = (tagMap[name] || 0) + 1
          }
        })
      })
    })
  } else if (type === 'plan') {
    const list = getRawList('plan_all')
    list.forEach(item => {
      if (item.is_deleted === 1) return
      const tags = Array.isArray(item.tags) ? item.tags : []
      tags.forEach(t => {
        if (t && t.trim()) {
          const name = t.trim()
          tagMap[name] = (tagMap[name] || 0) + 1
        }
      })
    })
  }

  // 转为标签列表（复用注册表中的颜色，新标签给自动色）
  const registry = getTags(type)
  const registryMap = {}
  registry.forEach(r => { registryMap[r.name] = r.color || tagColors[0] })

  const usedColors = new Set(Object.values(registryMap))
  let colorIdx = 0

  // 合并：数据中出现的标签 + 注册表中的标签（count=0）
  const allNames = new Set([...Object.keys(tagMap), ...Object.keys(registryMap)])
  const result = [...allNames].sort((a, b) => (tagMap[b] || 0) - (tagMap[a] || 0)).map(name => {
    let color = registryMap[name]
    if (!color) {
      // 分配未使用过的颜色
      while (usedColors.has(tagColors[colorIdx % tagColors.length])) {
        colorIdx++
        if (colorIdx > tagColors.length * 2) break
      }
      color = tagColors[colorIdx % tagColors.length]
      usedColors.add(color)
      colorIdx++
    }
    return { name, color, count: tagMap[name] || 0 }
  })

  return result
}

const tagColors = [
  '#18181B', '#10B981', '#F59E0B', '#EF4444', '#3F3F46',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6',
  '#3B82F6', '#22C55E', '#EAB308', '#DC2626', '#52525B'
]

/** 添加自定义标签到注册表 */
export function addCustomTag(type, tagName, color) {
  const tags = getTags(type)
  const exists = tags.find(t => t.name === tagName)
  if (exists) {
    if (color) exists.color = color
    setTags(type, tags)
    return exists
  }
  // 分配颜色
  const usedColors = new Set(tags.map(t => t.color))
  const c = color || tagColors.find(c => !usedColors.has(c)) || tagColors[tags.length % tagColors.length]
  const newTag = { name: tagName, color: c }
  tags.push(newTag)
  setTags(type, tags)
  return newTag
}

/** 从注册表删除标签 */
export function removeCustomTag(type, tagName) {
  const tags = getTags(type).filter(t => t.name !== tagName)
  setTags(type, tags)
}

// ==================== 辅助 ====================

/** 读取原始列表（含已删除），仅内部使用 */
function getRawList(key) {
  const raw = uni.getStorageSync(key)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/** 从时间戳提取 YYYY-MM */
function getMonthFromDate(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 从日期字符串提取 YYYY-MM（容错版）
 *  合法输入：YYYY-MM-DD / YYYY-MM / YYYY/MM/DD / ISO 带时间
 *  非法输入（"今天"/"昨天"/空串/乱码）→ fallback 到当前月，避免存到错误 key
 */
function getMonthFromDateStr(dateStr) {
  if (typeof dateStr === 'string' && dateStr) {
    const m = dateStr.trim().match(/^(\d{4})[-/](\d{1,2})/)
    if (m) {
      const y = parseInt(m[1])
      const mo = parseInt(m[2])
      if (mo >= 1 && mo <= 12) {
        return `${y}-${String(mo).padStart(2, '0')}`
      }
    }
  }
  // fallback：当前月
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
