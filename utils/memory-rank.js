/**
 * memory-rank.js — 记忆相关度排序（BM25 简化版 + 时间衰减 + 语义扩展）
 *
 * 3.5.11：长期记忆注入从「最近 N 条」改为「按当前消息检索 top-N」，
 * 解决长期使用后早期关键记忆被最近条目挤出上下文的问题。
 *
 * 3.5.18：查询词表先过 memory-synonyms.js 做同义分组 + 拼音桥接扩展，
 * 再按权重累加 BM25 分（字面 1.0 / 全拼 0.75 / 首字母 0.65 / 同义扩 0.6），
 * 修「用户说对象、记忆里写女朋友就召不回来」。
 *
 * 纯函数、不依赖 uni，可直接单测（tests/memory-rank.test.js）。
 */

import { expandTerms } from './memory-synonyms.js'

/** CJK 连续片段（含日文假名、韩文音节） */
const CJK_RUN_RE = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g
/** ASCII 单词 */
const ASCII_WORD_RE = /[a-z0-9]+/g

/** BM25 词频饱和参数 */
const K1 = 1.2
/** 时间衰减在总分中的权重（保证同分时新的在前，但不让新条目盖过强相关） */
const RECENCY_WEIGHT = 0.35
/** 时间半衰期（天） */
const HALF_LIFE_DAYS = 45
const DAY_MS = 24 * 60 * 60 * 1000

/** 分类权重：事实/偏好比对话摘要更值得进上下文 */
const CATEGORY_WEIGHT = { fact: 1.25, preference: 1.25, event: 1.1, summary: 0.85, other: 1 }

/**
 * 分词：CJK 取二元组（单字片段取本身），ASCII 取长度大于 1 的单词
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  const s = String(text == null ? '' : text).toLowerCase()
  if (!s) return []
  const out = []

  const words = s.match(ASCII_WORD_RE) || []
  for (const w of words) {
    if (w.length > 1) out.push(w)
  }

  const runs = s.match(CJK_RUN_RE) || []
  for (const run of runs) {
    if (run.length === 1) {
      out.push(run)
      continue
    }
    for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2))
    out.push(run[run.length - 1])
  }

  return out
}

/**
 * 构建带权重的检索项
 *
 * 基础分词 →（可选）同义 / 拼音扩展 → 扩展结果回落进同一 bigram 空间，同词取最高权重。
 * 关键：扩展出的整词（如「女朋友」）必须再切一次二元组，否则永远匹配不上同样按二元组
 * 切分的文档词表（历史 bug：扩展词直接参与匹配，召回为 0）。
 *
 * @param {string} query
 * @param {boolean} [includeSynonyms]
 * @returns {Array<{term:string, weight:number, from:string}>}
 */
export function buildQueryTerms(query, includeSynonyms = true) {
  const base = [...new Set(tokenize(query))]
  const source = includeSynonyms
    ? expandTerms(base)
    : base.map(term => ({ term, weight: 1, from: 'self' }))

  const weight = new Map()
  const origin = new Map()
  for (const item of source) {
    for (const token of tokenize(item.term)) {
      // 扩展词只取二元组：末位单字是分词器补的，参与匹配只会引噪声（伴侣 → 侣、妻子 → 子）
      if (item.from !== 'self' && item.term.length > 1 && token.length === 1) continue
      const prev = weight.get(token)
      if (prev === undefined || item.weight > prev) {
        weight.set(token, item.weight)
        origin.set(token, item.from)
      }
    }
  }
  return [...weight.entries()].map(([term, w]) => ({ term, weight: w, from: origin.get(term) }))
}

/**
 * 计算每条记忆与 query 的相关度分数
 * 分数 = BM25(词项) * 分类权重 * 时间衰减权重（衰减以加项形式并入）
 * @param {string} query 当前用户消息
 * @param {Array} memories 记忆列表（{content, category, createdAt, updatedAt}）
 * @param {Object} [opts] { now:Number, includeSynonyms:Boolean }
 * @returns {Array<{memory:Object, score:Number, rank:Number}>} 按 rank 倒序
 */
export function rankMemories(query, memories, opts = {}) {
  const list = Array.isArray(memories) ? memories.filter(m => m && m.content) : []
  if (list.length === 0) return []

  const now = typeof opts.now === 'number' ? opts.now : Date.now()
  // 3.5.18：语义扩展（同义分组 + 拼音桥接）。includeSynonyms:false 可退回纯字面匹配
  const queryTerms = buildQueryTerms(query, opts.includeSynonyms !== false)

  const docTokens = list.map(m => tokenize(m.content))
  const df = new Map()
  for (const tokens of docTokens) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) || 0) + 1)
  }

  const total = list.length
  const scored = list.map((memory, i) => {
    const tf = new Map()
    for (const t of docTokens[i]) tf.set(t, (tf.get(t) || 0) + 1)

    let score = 0
    for (const { term, weight } of queryTerms) {
      const freq = tf.get(term) || 0
      if (freq === 0) continue
      const docFreq = df.get(term) || 1
      const idf = Math.log(1 + (total - docFreq + 0.5) / (docFreq + 0.5))
      score += weight * idf * (freq / (freq + K1))
    }

    const ts = memory.updatedAt || memory.createdAt || 0
    const ageDays = ts > 0 ? Math.max(0, (now - ts) / DAY_MS) : 365
    const recency = Math.pow(0.5, ageDays / HALF_LIFE_DAYS)
    const categoryWeight = CATEGORY_WEIGHT[memory.category] || 1

    const rank = (score + RECENCY_WEIGHT * recency * (score > 0 ? 1 : 0)) * categoryWeight
    return { memory, score, rank }
  })

  return scored.sort((a, b) => (b.rank - a.rank) || (b.score - a.score))
}

/**
 * 选取要注入上下文的记忆
 * 有相关命中 → 按相关度排序取前 limit 条；无命中（或 query 为空）→ 回落最近 limit 条
 * @param {string} query
 * @param {Array} memories
 * @param {Object} [opts] { limit:Number, now:Number, includeSynonyms:Boolean }
 * @returns {Array} 记忆列表
 */
export function selectMemories(query, memories, opts = {}) {
  const list = Array.isArray(memories) ? memories.filter(m => m && m.content) : []
  if (list.length === 0) return []
  const limit = opts.limit > 0 ? opts.limit : 30

  const ranked = rankMemories(query, list, opts).filter(item => item.score > 0)
  if (ranked.length > 0) return ranked.slice(0, limit).map(item => item.memory)

  return list
    .slice()
    .sort((a, b) => ((b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)))
    .slice(0, limit)
}