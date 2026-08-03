/**
 * constants.js — AI 模块共享常量
 *
 * 操作完成语检测统一管理，消除散落在 response-parser / autoExecutor / fallback 三处的重复正则。
 * 新增操作完成语时只需改这一处。
 */

/** AI 声称操作完成的触发词（基础集） */
export const OP_CLAIM_WORDS = [
  '已记录', '已帮你', '已创建', '已添加', '记好了',
  '已保存', '已写入', '已记账', '帮你记了', '帮你建了',
  '已帮你记录', '已更新', '已修改', '已删除', '已生成'
]

/** 扩展触发词（autoExecutor 专用，含更宽泛的匹配） */
export const OP_CLAIM_WORDS_EXT = [
  ...OP_CLAIM_WORDS,
  '已记', '记了一笔', '帮你', '已帮',
  '账单已', '记录已', '计划已', '已为你',
  '记下了', '帮你记', '帮你建'
]

/** 构建检测正则 */
function buildRegex(words) {
  return new RegExp(words.join('|'))
}

/** 构建替换正则（部分词后跟 [^，。\n]* 以吃掉后续修饰语） */
function buildReplaceRegex(words) {
  const withTail = words.map(w => `${w}[^，。\\n]*`)
  return new RegExp(withTail.join('|'), 'g')
}

/** AI 声称操作完成 — 检测正则（基础集，response-parser 用） */
export const OP_CLAIM_RE = buildRegex(OP_CLAIM_WORDS)

/** AI 声称操作完成 — 检测正则（扩展集，autoExecutor 用） */
export const OP_CLAIM_RE_EXT = buildRegex(OP_CLAIM_WORDS_EXT)

/** AI 声称操作完成 — 替换正则（修改 reply 用） */
export const OP_CLAIM_REPLACE_RE = buildReplaceRegex(OP_CLAIM_WORDS)

/** fallback 场景 reply 触发正则（关联记录/日记等场景，用模糊匹配） */
export const OP_CLAIM_RE_FALLBACK = /.*记|.*帮|记下了|帮你|已更新|已创建|已添加|已保存|已写入/

/** 关系类型映射表 */
export const RELATION_TYPES = [
  [/(?:我的)?女朋友/, '女朋友'],
  [/(?:我的)?男朋友/, '男朋友'],
  [/(?:我的)?老婆|妻子/, '老婆'],
  [/(?:我的)?老公|丈夫/, '老公'],
  [/(?:我的)?妈妈|母亲/, '妈妈'],
  [/(?:我的)?爸爸|父亲/, '爸爸'],
  [/(?:我的)?儿子/, '儿子'],
  [/(?:我的)?女儿/, '女儿'],
  [/(?:我的)?(?:兄弟|哥哥|弟弟)/, '兄弟'],
  [/(?:我的)?(?:姐妹|姐姐|妹妹)/, '姐妹'],
  [/(?:我的)?闺蜜/, '闺蜜'],
  [/(?:我的)?哥们/, '哥们'],
  [/(?:我的)?同事/, '同事'],
  [/(?:我的)?同学/, '同学'],
  [/(?:我的)?老板/, '老板'],
  [/(?:我的)?老师/, '老师'],
  [/(?:我的)?领导/, '领导'],
  [/(?:我的)?下属/, '下属'],
  [/(?:我的)?邻居/, '邻居'],
  [/(?:我的)?客户/, '客户'],
  [/(?:我的)?合伙人/, '合伙人'],
  [/(?:我的)?朋友/, '朋友']
]

/** 关系关键词检测（用于 fallback 关系图谱入口判断） */
export const RELATION_KEYWORDS_RE = /女朋友|男朋友|老婆|老公|妻子|丈夫|朋友|同事|同学|老板|老师|妈妈|爸爸|儿子|女儿|兄弟|姐妹|闺蜜|哥们|领导|下属|邻居|客户|合伙人/
