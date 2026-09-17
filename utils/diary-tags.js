/**
 * diary-tags.js — 记录自动打标签（4.2.0，纯函数）
 *
 * 设计约束（来自市面方案对比的结论）：分类只留一个维度，所以标签要「自动来」而不是「手动选」。
 * 两条规则，先保守后扩展：
 *   1. 命中已有标签库里的名字 → 直接用它（不新建，防止标签爆炸）
 *   2. 命中内置关键词表 → 用对应标签（仍优先取标签库里已有的同义名）
 * 最多 3 个；都不命中就返回空数组（宁可不打，不要乱打）。
 */

/** 内置关键词 → 标签（用户标签库里有同名/近义时优先用户那套） */
export const KEYWORD_TAGS = [
  { tag: '工作', words: ['上班', '加班', '会议', '项目', '客户', '周报', '汇报', '同事', '领导', '面试', '简历', 'offer', '离职'] },
  { tag: '学习', words: ['复习', '背单词', '听力', '阅读', '作文', '翻译', '六级', '四级', '考研', '课程', '上课', '作业', '考试', '刷题'] },
  { tag: '健康', words: ['跑步', '健身', '运动', '锻炼', '早睡', '睡觉', '失眠', '体检', '感冒', '吃药', '医院', '饮食', '减肥'] },
  { tag: '心情', words: ['开心', '难过', '焦虑', '烦躁', '低落', '委屈', '崩溃', '压力', '放松', '平静', 'emo'] },
  { tag: '社交', words: ['朋友', '聚会', '吃饭', '聊天', '约会', '阿伟', '爸妈', '家人', '打电话'] },
  { tag: '生活', words: ['买菜', '做饭', '打扫', '房间', '快递', '房租', '水电', '宠物', '听歌', '电影', '游戏'] },
  { tag: '账目', words: ['花了', '买了', '支出', '收入', '记账', '工资'] },
  { tag: '灵感', words: ['灵感', '点子', '想法', '突然想到'] },
  { tag: '闪念', words: ['闪念', '碎片'] }
]

/** 上限：一次最多自动打几个标签 */
export const AUTO_TAG_LIMIT = 3

/**
 * 建议标签
 * @param {string} text 记录正文（含标题）
 * @param {string[]} existingTagNames 标签库里已有的标签名（用于优先复用）
 * @param {number} [limit]
 * @returns {string[]} 0-3 个标签
 */
export function suggestTags(text, existingTagNames, limit) {
  const raw = String(text == null ? '' : text)
  if (!raw.trim()) return []
  const max = Number.isFinite(Number(limit)) ? Number(limit) : AUTO_TAG_LIMIT
  const known = (Array.isArray(existingTagNames) ? existingTagNames : []).filter(n => typeof n === 'string' && n)
  const knownSet = new Set(known)

  const out = []
  const push = (name) => {
    if (!name || out.includes(name) || out.length >= max) return
    out.push(name)
  }

  // 规则 1：正文里直接出现了已有标签的名字（最长优先，避免「工作」吃掉「工作日志」）
  const sortedKnown = [...known].sort((a, b) => b.length - a.length)
  sortedKnown.forEach(name => {
    if (raw.indexOf(name) >= 0) push(name)
  })

  // 规则 2：内置关键词表；标签库里已有同名标签就用库里的名字
  KEYWORD_TAGS.forEach(rule => {
    if (out.length >= max) return
    if (!rule.words.some(w => raw.indexOf(w) >= 0)) return
    push(rule.tag)
  })

  return out
}