/**
 * text-outline.js — 长文目录解析（3.9.0）
 *
 * 给「记录阅读页」用：把一条记录的正文按章节切开，生成左侧目录尺的刻度。
 *
 * 支持三种章节写法（混用也行）：
 *   Markdown 标题   ## 一、视听一致            （推荐，正文也能用 MarkdownRenderer 渲染）
 *   方括号标题      【一、视听一致】
 *   编号标题        “1. 视听一致” / “一、视听一致”（行要短，避免把正文句子当标题）
 *
 * 纯函数、不碰 uni，也不测量 DOM：刻度位置按「章节起始行 ÷ 总行数」估算，
 * 用于目录尺的粗略定位（跳转本身走 scroll-into-view 锚点，是精确的）。
 */

/** 至少这么多章节才值得显示目录尺 */
export const OUTLINE_MIN_SECTIONS = 3

/** 编号标题行最长多少字才算标题（超了大概率是正文） */
export const OUTLINE_MAX_TITLE_LEN = 30

/** 识别一行是不是章节标题 → { level, title } 或 null */
export function parseHeading(line) {
  const raw = String(line == null ? '' : line).trim()
  if (!raw) return null

  // Markdown 标题（1-4 级）
  const md = raw.match(/^(#{1,4})\s+(.+?)\s*#*$/)
  if (md) {
    const title = md[2].trim()
    if (title) return { level: md[1].length, title: title }
  }

  // 【标题】
  const bracket = raw.match(/^【(.+?)】\s*$/)
  if (bracket) {
    const title = bracket[1].trim()
    if (title) return { level: 2, title: title }
  }

  // 编号标题：1. / 1、/ 一、  —— 限长，避免正文里的「1. 先看题干…」被当成标题
  const numbered = raw.match(/^(?:\d{1,2}[.、)]|[一二三四五六七八九十]{1,2}[、.])\s*(.+)$/)
  if (numbered) {
    const title = numbered[1].trim()
    if (title && title.length <= OUTLINE_MAX_TITLE_LEN && !/[。！？]$/.test(title)) {
      return { level: 2, title: raw }
    }
  }

  return null
}

/**
 * 逐行解析，跳过围栏代码块里的内容（``` 之间不认标题）
 * @param {string} text
 * @returns {Array<{ key, index, level, title, line, percent }>}
 */
export function extractOutline(text) {
  const lines = String(text == null ? '' : text).split('\n')
  const total = lines.length
  const out = []
  let inFence = false
  for (let i = 0; i < total; i++) {
    const line = lines[i]
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const head = parseHeading(line)
    if (!head) continue
    out.push({
      key: 'sec-' + out.length,
      index: out.length,
      level: head.level,
      title: head.title,
      line: i,
      percent: total > 1 ? Math.round((i / (total - 1)) * 10000) / 100 : 0
    })
  }
  return out
}

/**
 * 按章节切正文：每段含标题行之后的内容，直到下一个标题
 * @param {string} text
 * @returns {Array<{ key, index, title, level, body }>} 首个元素可能是没有标题的开头（title 为空串）
 */
export function splitSections(text) {
  const lines = String(text == null ? '' : text).split('\n')
  const headings = extractOutline(text)
  const out = []
  const push = (title, level, bodyLines, index) => {
    const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    out.push({ key: 'sec-' + index, index: index, title: title, level: level, body: body })
  }

  if (headings.length === 0) {
    push('', 2, lines, 0)
    return out
  }

  // 第一个标题之前的内容（前言）
  if (headings[0].line > 0) {
    const pre = lines.slice(0, headings[0].line)
    if (pre.join('').trim()) push('', 2, pre, 0)
  }

  let cursor = 0
  headings.forEach((h, i) => {
    const start = h.line + 1
    const end = i + 1 < headings.length ? headings[i + 1].line : lines.length
    const index = out.length
    push(h.title, h.level, lines.slice(start, end), index)
    cursor = end
  })
  return out
}

/** 章节数够不够显示目录尺 */
export function shouldShowOutline(sectionCount, min) {
  const count = Number(sectionCount)
  if (!Number.isFinite(count)) return false
  const floor = Number.isFinite(Number(min)) ? Number(min) : OUTLINE_MIN_SECTIONS
  return count >= floor
}

/** 目录尺刻度：把 outline 转成对话尺那套 { key, index, label, percent } */
export function buildOutlineTicks(outline) {
  return (Array.isArray(outline) ? outline : [])
    .filter(s => s && s.title)
    .map(s => ({
      key: s.key,
      index: s.index,
      label: s.title,
      percent: Number(s.percent) || 0
    }))
}

/**
 * 阅读进度（0-100）：读到哪了 —— 底部进度条用
 * 取「视口底部 ÷ 总高度」，比 scrollTop 更贴近「读完多少」的直觉
 * @param {number} scrollTop
 * @param {number} scrollHeight
 * @param {number} clientHeight
 * @returns {number} 0-100 的整数
 */
export function readingProgress(scrollTop, scrollHeight, clientHeight) {
  const total = Number(scrollHeight) || 0
  const view = Number(clientHeight) || 0
  const top = Number(scrollTop) || 0
  if (total <= 0 || view <= 0) return 0
  if (view >= total) return 100
  const pct = ((top + view) / total) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

/**
 * 当前读到哪一节（按进度落在哪个小节的区间里）
 * @param {Array} outline extractOutline 的结果
 * @param {number} progress 0-100
 * @returns {{ index: number, title: string, total: number }|null}
 */
export function sectionAtProgress(outline, progress) {
  const list = (Array.isArray(outline) ? outline : []).filter(s => s && s.title)
  if (list.length === 0) return null
  const p = Math.max(0, Math.min(100, Number(progress) || 0))
  let hit = list[0]
  for (const s of list) {
    if (s.percent <= p + 0.001) hit = s
    else break
  }
  return { index: list.indexOf(hit) + 1, title: hit.title, total: list.length }
}

/** 只保留有标题的章节（目录尺与预览用） */
export function titledSections(sections) {
  return (Array.isArray(sections) ? sections : []).filter(s => s && s.title)
}