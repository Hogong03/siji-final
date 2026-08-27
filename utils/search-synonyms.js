/**
 * search-synonyms.js — 语义检索同义词扩展
 *
 * 让 query_diary / query_combined 支持模糊语义匹配：
 * 用户说"焦虑"能查到"压力/失眠/睡不好"相关的记录。
 * 纯函数无依赖，可单测。
 */

/** 主题词 → 同义词组 */
export const SEARCH_SYNONYMS = {
  焦虑: ['压力', '烦躁', '担心', '紧张', '失眠', '睡不好', '内耗', '不安'],
  开心: ['高兴', '快乐', '愉快', '兴奋', '不错', '舒服', '美好'],
  疲惫: ['累', '疲惫', '疲劳', '加班', '熬夜', '辛苦', '乏力'],
  生气: ['愤怒', '不爽', '烦', '讨厌', '吵架', '冲突', '无语'],
  工作: ['上班', '加班', '项目', '会议', '汇报', '同事', '老板', '客户', '职场'],
  健康: ['生病', '感冒', '发烧', '吃药', '医院', '健身', '跑步', '运动', '锻炼'],
  饮食: ['吃饭', '美食', '餐厅', '外卖', '咖啡', '奶茶', '火锅', '烧烤'],
  旅行: ['出差', '旅游', '机场', '酒店', '度假', '高铁', '机票'],
  学习: ['读书', '备考', '考试', '学习', '复习', '课程'],
  感情: ['恋爱', '对象', '女朋友', '男朋友', '分手', '约会', '相亲']
}

/**
 * 扩展关键词：命中主题词或任一同义词时返回整组词
 * @param {string} keyword - 用户输入关键词
 * @returns {string[]} 扩展后的关键词列表（至少含原词）
 */
export function expandKeywords(keyword) {
  const kw = String(keyword || '').trim()
  if (!kw) return []
  const set = new Set([kw])

  // 正向：关键词包含主题词
  for (const [k, syns] of Object.entries(SEARCH_SYNONYMS)) {
    if (kw.includes(k) || k.includes(kw)) {
      set.add(k)
      syns.forEach(s => set.add(s))
    }
  }

  // 反向：关键词是某组同义词（或子串）
  for (const [k, syns] of Object.entries(SEARCH_SYNONYMS)) {
    if (syns.some(s => kw.includes(s) || s.includes(kw))) {
      set.add(k)
      syns.forEach(s => set.add(s))
    }
  }

  return [...set]
}

/**
 * 文本是否命中任一扩展词（不区分大小写）
 * @param {string} text - 待匹配文本
 * @param {string[]} keywords - 扩展后的关键词列表
 * @returns {boolean}
 */
export function matchesAnyKeywords(text, keywords) {
  const t = String(text || '').toLowerCase()
  return keywords.some(k => t.includes(String(k).toLowerCase()))
}
