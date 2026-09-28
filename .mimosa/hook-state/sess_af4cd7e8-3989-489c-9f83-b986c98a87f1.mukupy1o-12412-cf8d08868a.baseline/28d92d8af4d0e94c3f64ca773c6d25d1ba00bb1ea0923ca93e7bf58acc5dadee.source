/**
 * 本地索引 & 全局搜索
 *
 * 索引策略：关键词倒排索引，存于 siji_index
 * 支持日记/账单/计划的快速搜索
 */

import { getRawList, getMonthFromDate } from './helpers.js'
import { asyncSetStorageJSON } from '../store-helpers.js'

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

  asyncSetStorageJSON(INDEX_KEY, index)
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
  asyncSetStorageJSON(INDEX_KEY, index)
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
